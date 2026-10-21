
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ================= 常量与数据 ================= */

  var IMG_EXTS = ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tif', '.tiff'];
  var strokeWidth = 10;
  var MIN_ZOOM = 0.1, MAX_ZOOM = 10, HANDLE_PX = 8;
  var CACHE_LIMIT = 8;

  var KEY_THEME = 'xunjian_theme';
  var KEY_NO_PROMPT = 'xunjian_no_prompt';
  var KEY_DEFECT_DICT = 'xunjian_defect_dict_v7';
  var KEY_ADJACENCY = 'xunjian_custom_adjacency_v7';
  var KEY_OUTPUT_NAME = 'xunjian_output_name';
  var KEY_INPUT_NAME = 'xunjian_input_dir_name';
  var KEY_HIDDEN = 'xunjian_hidden_defects';
  var KEY_LEFT_WIDTH = 'xunjian_left_width';
  var KEY_RIGHT_WIDTH = 'xunjian_right_width';
  var KEY_STROKE = 'xunjian_stroke_width';
  var KEY_VIEWED = 'xunjian_viewed_photos_v3';
  var KEY_CANDIDATE_POOL = 'xunjian_candidate_pool_v8';
  var LEGACY_KEY_CANDIDATE_POOL = 'xunjian_candidate_pool_v7';
  var KEY_CRITICAL_DEFECTS = 'xunjian_critical_defects_v1';
  var KEY_NAV_PREV_KEY = 'xunjian_nav_prev_key';
  var KEY_NAV_NEXT_KEY = 'xunjian_nav_next_key';
  var KEY_NAV_SAVE_KEY = 'xunjian_nav_save_key';
  var KEY_MOUSE_SIDE_ENABLED = 'xunjian_mouse_side_enabled';
  var KEY_MOUSE_PREV_BTN = 'xunjian_mouse_prev_btn';
  var KEY_MOUSE_NEXT_BTN = 'xunjian_mouse_next_btn';
  var KEY_MOUSE_CLICK_NAV_ENABLED = 'xunjian_mouse_click_nav_enabled';

  // 目录句柄持久化 (IndexedDB)
  var DB_NAME = 'xunjian_dirs_storage_v1';
  var DB_STORE = 'dir_handles';
  var lastInputHandle = null;
  var lastOutputHandle = null;
  var savedInputName = '';

  function openDirDB() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(null); return; }
      try {
        var req = indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(DB_STORE)) {
            db.createObjectStore(DB_STORE);
          }
          if (!db.objectStoreNames.contains('photo_records_v46')) db.createObjectStore('photo_records_v46');
        };
        req.onblocked = function () { toast('请关闭其他旧版工具页面，再重新打开目录以完成存储升级', 8000); };
        req.onsuccess = function (e) { var db=e.target.result; db.onversionchange=function(){db.close();}; resolve(db); };
        req.onerror = function () { resolve(null); };
      } catch (err) {
        resolve(null);
      }
    });
  }

  async function saveDirHandle(key, handle) {
    try {
      var db = await openDirDB();
      if (!db) return false;
      return new Promise(function (resolve) {
        var tx = db.transaction(DB_STORE, 'readwrite');
        var store = tx.objectStore(DB_STORE);
        var req = store.put(handle, key);
        tx.oncomplete = function () { db.close(); resolve(true); };
        tx.onabort = tx.onerror = function () { db.close(); resolve(false); };
      });
    } catch (e) {
      console.warn('saveDirHandle error:', e);
      return false;
    }
  }

  async function getDirHandle(key) {
    try {
      var db = await openDirDB();
      if (!db) return null;
      return new Promise(function (resolve) {
        var tx = db.transaction(DB_STORE, 'readonly');
        var store = tx.objectStore(DB_STORE);
        var req = store.get(key);
        var value=null;
        req.onsuccess = function (e) { value=e.target.result || null;if(window.DesktopFS)value=DesktopFS.revive(value); };
        tx.oncomplete=function(){db.close();resolve(value);};
        tx.onabort=tx.onerror=function(){db.close();resolve(null);};
      });
    } catch (e) {
      console.warn('getDirHandle error:', e);
      return null;
    }
  }

  // 38项《常规配电缺陷描述》官方模板红色危急缺陷标准集
  var CRITICAL_DEFECTS = [
    '_杆塔-倾斜',
    '_杆塔-破损',
    '_柱瓶-表面污秽，疑似有放电灼烧痕迹',
    '_柱瓶-无扎线',
    '_柱瓶-绑扎线松脱(导线脱落)',
    '_柱瓶-脱落',
    '_悬瓶-破损（损伤、断裂、脱落）',
    '_悬瓶-表面污秽，疑似有放电灼烧痕迹',
    '_通道-通道树障、树木茂盛',
    '_跌落式熔断器-异物',
    '_跌落式熔断器-有放电痕迹',
    '_跌落式熔断器-有灼烧痕迹',
    '_跌落式熔断器-疑似灼烧痕迹',
    '_跌落式熔断器-熔断器跌落',
    '_避雷器-异物',
    '_避雷器-有放电痕迹',
    '_避雷器-有灼烧痕迹',
    '_避雷器-疑似灼烧痕迹',
    '_避雷器-损坏',
    '_柱上开关-异物',
    '_柱上开关-有放电痕迹',
    '_柱上开关-有灼烧痕迹',
    '_柱上开关-疑似灼烧痕迹',
    '_配电变压器-异物',
    '_配电变压器-有灼烧痕迹',
    '_配电变压器-疑似灼烧痕迹',
    '_变压器-异物',
    '_变压器-有灼烧痕迹',
    '_变压器-疑似灼烧痕迹',
    '_引线-断股、扭曲',
    '_导线-裸导线',
    '_导线-脱落',
    '_导线-有灼烧痕迹',
    '_导线-疑似灼烧痕迹',
    '_导线-固定卡扣缺失',
    '_导线-异物悬挂',
    '_电缆终端-有灼烧痕迹',
    '_电缆终端-疑似灼烧痕迹',
    '_刀闸-瓷瓶脏污，疑似放电痕迹',
    '_刀闸-有灼烧痕迹',
    '_互感器-破损'
  ];
  var CRITICAL_DEFECT_SET = new Set(CRITICAL_DEFECTS);

  // 危急缺陷由用户在右侧「缺陷列表」中自行维护。首次使用时默认采用系统模板中的危急缺陷；
  // 一旦用户手动调整，后续保存、导出/导入模板均以用户选择为准。
  function isCriticalDefectTag(tag) {
    if (!tag) return false;
    return criticalDefects.has(String(tag).trim());
  }

  function saveCriticalDefects() {
    try { localStorage.setItem(KEY_CRITICAL_DEFECTS, JSON.stringify(Array.from(criticalDefects))); } catch (e) {}
    sideDictVersion++;
  }

  function loadCriticalDefects() {
    try {
      var raw = localStorage.getItem(KEY_CRITICAL_DEFECTS);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          criticalDefects = new Set(arr.map(function (x) { return String(x).trim(); }).filter(Boolean));
          return;
        }
      }
    } catch (e) {}
    criticalDefects = new Set(CRITICAL_DEFECTS);
  }

  function toggleCriticalDefect(tag) {
    var t = String(tag || '').trim();
    if (!t) return;
    if (criticalDefects.has(t)) {
      criticalDefects.delete(t);
      saveCriticalDefects();
      toast('✓ 已取消【' + t + '】的危急属性');
    } else {
      criticalDefects.add(t);
      saveCriticalDefects();
      toast('✓ 已将【' + t + '】设为危急缺陷');
    }
    renderSide(true);
    updateHud();
  }

  // 默认严格按《常规配电缺陷描述》标准的设备部件/位置归类字典（共24大类，严格遵循表格标签命名）
  var DEFAULT_DEFECT_DICT = {
    '金具': [
      '_金具-U型挂环-缺销钉',
      '_金具-U型挂环-销钉即将脱出',
      '_金具-U型挂环-螺栓即将脱出',
      '_金具-U型挂环-螺母缺失',
      '_金具-U型挂环-螺母松动',
      '_金具-直角挂板-缺销钉',
      '_金具-直角挂板-销钉即将脱出',
      '_金具-直角挂板-螺栓即将脱出',
      '_金具-直角挂板-螺母缺失',
      '_金具-直角挂板-螺母松动',
      '_金具-碗头挂板-缺销钉',
      '_金具-碗头挂板-销钉即将脱出',
      '_金具-碗头挂板-螺栓即将脱出',
      '_金具-碗头挂板-螺母缺失',
      '_金具-碗头挂板-螺母松动',
      '_金具-平行挂板-缺销钉',
      '_金具-平行挂板-销钉即将脱出',
      '_金具-平行挂板-螺栓即将脱出',
      '_金具-平行挂板-螺母缺失',
      '_金具-平行挂板-螺母松动',
      '_金具-球头挂环-缺销钉',
      '_金具-球头挂环-销钉即将脱出',
      '_金具-球头挂环-螺栓即将脱出',
      '_金具-球头挂环-螺母缺失',
      '_金具-球头挂环-螺母松动'
    ],
    '杆塔': [
      '_杆塔-异物',
      '_杆塔-倾斜',
      '_杆塔-树木包围',
      '_杆塔-与树木安全距离不足',
      '_杆塔-裂纹',
      '_杆塔-破损',
      '_杆塔-鸟窝',
      '_杆塔-藤蔓攀爬'
    ],
    '塔基': [
      '_塔基-杂物堆积',
      '_塔基-立柱水淹'
    ],
    '塔头': [
      '_塔头-混凝土杆顶部风化露筋',
      '_塔头-鸟窝'
    ],
    '杆号牌': [
      '_杆号牌-缺失',
      '_杆号牌-不对应',
      '_杆号牌-模糊',
      '_杆号牌-遮挡',
      '_杆号牌-损坏'
    ],
    '横担': [
      '_横担-歪斜',
      '_横担-有鸟窝',
      '_横担-有树枝',
      '_横担-有异物'
    ],
    '抱箍': [
      '_抱箍-缺螺栓',
      '_抱箍-松动'
    ],
    '附属设施': [
      '_附属设施-防鸟设施损坏'
    ],
    '柱瓶': [
      '_柱瓶-歪斜',
      '_柱瓶-破损',
      '_柱瓶-扎线不规范',
      '_柱瓶-缺失',
      '_柱瓶-表面脏污',
      '_柱瓶-表面污秽，疑似有放电灼烧痕迹',
      '_柱瓶-无扎线',
      '_柱瓶-绑扎线松脱(导线脱落)',
      '_柱瓶-脱落'
    ],
    '悬瓶': [
      '_悬瓶-轻微破损',
      '_悬瓶-破损（损伤、断裂、脱落）',
      '_悬瓶-表面脏污',
      '_悬瓶-表面污秽，疑似有放电灼烧痕迹',
      '_悬瓶-与导线安全距离不足'
    ],
    '通道': [
      '_通道-导线与树木安全距离不足',
      '_通道-通道树障、树木茂盛',
      '_通道-弧垂过低',
      '_通道-施工现场杂物堆积'
    ],
    '跌落式熔断器': [
      '_跌落式熔断器-异物',
      '_跌落式熔断器-绝缘护套缺失',
      '_跌落式熔断器-绝缘外露（松脱、损坏）',
      '_跌落式熔断器-有放电痕迹',
      '_跌落式熔断器-有灼烧痕迹',
      '_跌落式熔断器-疑似灼烧痕迹',
      '_跌落式熔断器-表面污秽',
      '_跌落式熔断器-熔管跌落',
      '_跌落式熔断器-熔管缺失',
      '_跌落式熔断器-熔断器跌落'
    ],
    '避雷器': [
      '_避雷器-异物',
      '_避雷器-绝缘护套缺失',
      '_避雷器-绝缘外露（松脱、损坏）',
      '_避雷器-有放电痕迹',
      '_避雷器-有灼烧痕迹',
      '_避雷器-疑似灼烧痕迹',
      '_避雷器-表面污秽',
      '_避雷器-脱扣脱落',
      '_避雷器-损坏'
    ],
    '柱上开关': [
      '_柱上开关-异物',
      '_柱上开关-绝缘护套缺失',
      '_柱上开关-绝缘外露（松脱、损坏）',
      '_柱上开关-有放电痕迹',
      '_柱上开关-有灼烧痕迹',
      '_柱上开关-疑似灼烧痕迹',
      '_柱上开关-表面污秽',
      '_柱上开关-铭牌缺失'
    ],
    '配电变压器': [
      '_配电变压器-异物',
      '_配电变压器-绝缘护套缺失',
      '_配电变压器-绝缘外露（松脱、损坏）',
      '_配电变压器-有灼烧痕迹',
      '_配电变压器-疑似灼烧痕迹',
      '_配电变压器-表面污秽',
      '_配电变压器-漏油',
      '_配电变压器-植被包围、藤蔓缠绕',
      '_配电变压器-锈蚀'
    ],
    '引线': [
      '_引线-断股、扭曲',
      '_引线-有灼烧痕迹',
      '_引线-疑似灼烧痕迹',
      '_引线-存在裸露、需绝缘包裹',
      '_引线-绝缘保护套老化、破损'
    ],
    '导线': [
      '_导线-裸导线',
      '_导线-松股',
      '_导线-断股',
      '_导线-脱落',
      '_导线-有灼烧痕迹',
      '_导线-疑似灼烧痕迹',
      '_导线-固定卡扣安装不牢固',
      '_导线-固定卡扣缺失',
      '_导线-绝缘层破损、绝缘外露',
      '_导线-异物悬挂'
    ],
    '线夹': [
      '_线夹-有灼烧痕迹',
      '_线夹-绝缘保护套缺失',
      '_线夹-绝缘保护套损坏'
    ],
    '接地环': [
      '_接地环-绝缘护罩缺失',
      '_接地环-绝缘外露'
    ],
    '接地引下线': [
      '_接地引下线-断开'
    ],
    '电缆终端': [
      '_电缆终端-绝缘护罩缺失',
      '_电缆终端-绝缘外露',
      '_电缆终端-有灼烧痕迹',
      '_电缆终端-疑似灼烧痕迹'
    ],
    '刀闸': [
      '_刀闸-绝缘护套缺失',
      '_刀闸-绝缘外露（松脱、损坏）',
      '_刀闸-瓷瓶脏污，疑似放电痕迹',
      '_刀闸-有灼烧痕迹',
      '_刀闸-瓷瓶破损',
      '_刀闸-刀片脱落'
    ],
    '互感器': [
      '_互感器-绝缘护套缺失',
      '_互感器-绝缘外露（松脱、损坏）',
      '_互感器-破损'
    ],
    '拉线': [
      '_拉线-楔形挂板-销钉缺失'
    ]
  };

  // 默认电力设备部件相近关联推荐图谱 (Adjacent / Related Equipment on Pole)
  var DEFAULT_LOCATION_ADJACENCY = {
    '金具': ['横担', '悬瓶', '柱瓶', '拉线', '抱箍', '导线'],
    '杆塔': ['塔全貌', '塔头', '塔基', '杆号牌', '抱箍', '横担', '拉线', '通道', '附属设施'],
    '塔基': ['杆塔', '塔全貌', '接地引下线', '拉线', '通道'],
    '塔头': ['杆塔', '塔全貌', '横担', '柱瓶', '附属设施'],
    '杆号牌': ['杆塔', '抱箍', '通道'],
    '横担': ['柱瓶', '悬瓶', '金具', '导线', '线夹', '接地环', '抱箍', '附属设施'],
    '左横担': ['横担', '柱瓶', '悬瓶', '金具', '导线', '线夹', '接地环'],
    '右横担': ['横担', '柱瓶', '悬瓶', '金具', '导线', '线夹', '接地环'],
    '抱箍': ['横担', '杆塔', '拉线', '金具'],
    '附属设施': ['横担', '塔头', '杆塔'],
    '柱瓶': ['悬瓶', '横担', '导线', '线夹', '接地环', '金具'],
    '左相柱瓶': ['柱瓶', '悬瓶', '横担', '导线', '线夹', '接地环', '金具'],
    '中相柱瓶': ['柱瓶', '悬瓶', '横担', '导线', '线夹', '接地环', '金具'],
    '右相柱瓶': ['柱瓶', '悬瓶', '横担', '导线', '线夹', '接地环', '金具'],
    '悬瓶': ['柱瓶', '横担', '金具', '导线', '线夹', '拉线'],
    '中相悬瓶': ['悬瓶', '柱瓶', '横担', '金具', '导线', '线夹'],
    '通道': ['杆塔', '塔全貌', '导线', '塔基', '拉线'],
    '跌落式熔断器': ['配电变压器', '避雷器', '柱上开关', '引线', '导线', '接地引下线'],
    '避雷器': ['跌落式熔断器', '配电变压器', '柱上开关', '接地引下线', '接地环', '引线', '导线'],
    '柱上开关': ['刀闸', '互感器', '跌落式熔断器', '引线', '避雷器', '电缆终端'],
    '配电变压器': ['跌落式熔断器', '避雷器', '柱上开关', '引线', '接地引下线', '接地环', '导线'],
    '引线': ['导线', '跌落式熔断器', '配电变压器', '避雷器', '柱上开关', '刀闸', '互感器', '电缆终端'],
    '导线': ['引线', '线夹', '接地环', '柱瓶', '悬瓶', '横担', '通道'],
    '线夹': ['导线', '引线', '接地环', '柱瓶', '悬瓶', '横担', '金具'],
    '接地环': ['导线', '引线', '线夹', '柱瓶', '避雷器'],
    '接地引下线': ['避雷器', '配电变压器', '杆塔', '塔基'],
    '电缆终端': ['避雷器', '柱上开关', '接地引下线', '引线'],
    '刀闸': ['柱上开关', '跌落式熔断器', '互感器', '引线', '柱瓶'],
    '互感器': ['柱上开关', '刀闸', '引线', '接地引下线'],
    '拉线': ['杆塔', '金具', '抱箍', '塔基', '通道']
  };

  var KNOWN_POSITIONS = [
    '金具', '杆塔', '塔基', '塔头', '杆号牌', '横担', '抱箍', '附属设施',
    '柱瓶', '悬瓶', '通道', '跌落式熔断器', '避雷器', '柱上开关', '配电变压器',
    '引线', '导线', '线夹', '接地环', '接地引下线', '电缆终端', '刀闸', '互感器', '拉线',
    '左横担', '右横担', '左相柱瓶', '中相柱瓶', '右相柱瓶', '中相悬瓶', '左相悬瓶', '右相悬瓶',
    '熔断器', '跌落保险', '变压器', '配变', '开关', '断路器', '真空断路器', '隔离开关',
    '引流线', '导线线夹', '耐张线夹', '悬垂线夹', '基础', '杆塔基础', '塔身抱箍', '号牌', '铭牌', '防鸟设施',
    '大号侧', '小号侧', 'A相', 'B相', 'C相', '全貌', '塔全貌'
  ];

  /* ================= 极简矢量图标 (SVG Icons) ================= */
  var ICONS = {
    // 关联推荐 (链接)
    link: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    // 编辑/重命名 (铅笔)
    edit: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>',
    // 添加 (加号)
    plus: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    // 删除 (垃圾桶)
    trash: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    // 移除/关闭 (叉号)
    close: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
  };

  /* ================= 标准弹窗交互（替代原生 prompt / confirm 警告框） ================= */

  function showPromptDialog(options) {
    return new Promise(function (resolve) {
      var modal = $('promptModal');
      var titleEl = $('promptModalTitle');
      var descEl = $('promptModalDesc');
      var inputEl = $('promptModalInput');
      var btnCancel = $('promptModalCancel');
      var btnConfirm = $('promptModalConfirm');

      titleEl.textContent = options.title || '编辑';
      if (options.desc) {
        descEl.textContent = options.desc;
        descEl.style.display = 'block';
      } else {
        descEl.style.display = 'none';
      }
      inputEl.placeholder = options.placeholder || '';
      inputEl.value = options.defaultValue || '';

      modal.classList.add('show');
      setTimeout(function () {
        inputEl.focus();
        inputEl.select();
      }, 50);

      function cleanup() {
        modal.classList.remove('show');
        btnConfirm.onclick = null;
        btnCancel.onclick = null;
        modal.onclick = null;
        inputEl.onkeydown = null;
      }

      function doConfirm() {
        var val = inputEl.value;
        if (options.validate) {
          var err = options.validate(val);
          if (err) { toast(err); return; }
        }
        cleanup();
        resolve(val);
      }

      function doCancel() {
        cleanup();
        resolve(null);
      }

      btnConfirm.onclick = doConfirm;
      btnCancel.onclick = doCancel;
      modal.onclick = function (e) {
        if (e.target === modal) doCancel();
      };
      inputEl.onkeydown = function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          doConfirm();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          doCancel();
        }
      };
    });
  }

  function showConfirmDialog(title, message) {
    return new Promise(function (resolve) {
      var modal = $('confirmModal');
      var titleEl = $('confirmModalTitle');
      var msgEl = $('confirmModalMessage');
      var btnCancel = $('confirmModalCancel');
      var btnConfirm = $('confirmModalConfirm');

      titleEl.textContent = title || '确认操作';
      msgEl.textContent = message || '确定要继续吗？';
      modal.classList.add('show');

      function cleanup() {
        modal.classList.remove('show');
        btnConfirm.onclick = null;
        btnCancel.onclick = null;
        modal.onclick = null;
        window.removeEventListener('keydown', keyHandler);
      }

      function keyHandler(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          cleanup();
          resolve(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cleanup();
          resolve(false);
        }
      }

      btnConfirm.onclick = function () { cleanup(); resolve(true); };
      btnCancel.onclick = function () { cleanup(); resolve(false); };
      modal.onclick = function (e) {
        if (e.target === modal) { cleanup(); resolve(false); }
      };
      window.addEventListener('keydown', keyHandler);
    });
  }

  /* ================= 状态 ================= */

  var state = {
    mode: null,
    files: [],            // {name, handle, file, mime, relPath, group}
    byName: new Map(),
    indexByName: new Map(),
    index: -1,
    meta: new Map(),      // name -> {boxes:[], appended:[], history:[], saved:false}
    cache: new Map(),     // name -> {url, img}
    view: { w: 0, h: 0, s: 1, zoom: 1, panX: 0, panY: 0, cx: 0, cy: 0 },
    natural: { w: 0, h: 0 },
    navBusy: false,
    markedFiles: new Set(),         // 输出目录中已标记保存的照片原始文件名
    markedBoxedHandles: new Map(),  // 原文件名 -> 缺陷圈示图 FileSystemFileHandle 句柄
    markedDefectTags: new Map(),    // 原文件名 -> 已标记保存的缺陷标签文本（如 '_导线断股'）
    criticalFiles: new Set(),       // 已独立保存过「危急缺陷」的原始文件名（与 markedFiles 完全独立统计）
    markedCounts: new Map(),        // 原文件名 -> 已标记保存的次数（同一照片二次编辑输出多个缺陷时递增）
    discoveredDirs: []              // 扫描过程中发现的所有子目录路径集合（包含空文件夹，确保杆塔数100%匹配实际文件夹数）
  };
  var output = { mainHandle: null, mainName: '' };
  var defectDict = JSON.parse(JSON.stringify(DEFAULT_DEFECT_DICT)); // 动态缺陷字典：category -> [texts]
  var locationAdjacency = JSON.parse(JSON.stringify(DEFAULT_LOCATION_ADJACENCY)); // 动态关联推荐图谱
  var candidatePool = [];          // 动态可增删改的候选分类词池
  var isCandidateManageMode = false; // 是否处于候选词池管理（增删改）模式
  var hiddenDefects = {};          // 被隐藏的缺陷名 -> true
  var criticalDefects = new Set(CRITICAL_DEFECTS); // 用户可自定义的危急缺陷标签集合，默认沿用系统模板
  var viewedPhotosMap = {};        // 已浏览查看过的照片文件名映射 -> true
  var filterMode = 'all';          // 'all' | 'marked' | 'unmarked' | 'unviewed'
  var collapsedGroups = new Set(); // 折叠的前缀分组名称集合
  var collapsedTowers = new Set(); // 折叠的杆塔分组标识集合
  var dirRegistry = new Map();     // relDirPath -> { handle, parentHandle, name } 文件夹句柄注册表
  var theme = 'light', colorTheme = 'light';
  var customPrevKey = 'a';
  var customNextKey = 'd';
  var customSaveKey = 'f';
  var mouseSideEnabled = true;
  var customPrevMouseBtn = 3;   // 鼠标侧键：后退键（罗技等鼠标标准编号，MouseEvent.button === 3）
  var customNextMouseBtn = 4;   // 鼠标侧键：前进键（MouseEvent.button === 4）
  var mouseClickNavEnabled = false; // 图片区域内：左键单击=下一张，右键单击=上一张（拖动仍为圈图/移动图片）
  var leftWidth = 320, rightWidth = 310;

  /* ================= DOM ================= */

  var btnFolder = $('btnFolder'), btnEmptyPick = $('btnEmptyPick');
  var inputFolderBtnText = $('inputFolderBtnText');
  var btnEmptyRestore = $('btnEmptyRestore'), emptyRestoreDirName = $('emptyRestoreDirName');
  var btnOutput = $('btnOutput'), outputDirName = $('outputDirName'), btnCreateOrigFromBoxed = $('btnCreateOrigFromBoxed'), btnCleanDefectNames = $('btnCleanDefectNames');
  var btnClassifyInsulation = $('btnClassifyInsulation'), btnClassifyInsulationMenu = $('btnClassifyInsulationMenu'), btnClassifyInsulationSettings = $('btnClassifyInsulationSettings');
  var strokeSlider = $('strokeSlider'), strokeVal = $('strokeVal');
  var searchInput = $('searchInput'), searchClear = $('searchClear');
  var btnExportTemplate = $('btnExportTemplate'), btnImportTemplate = $('btnImportTemplate');
  var btnPrev = $('btnPrev'), btnNext = $('btnNext');
  var btnBindPrevKey = $('btnBindPrevKey'), btnBindNextKey = $('btnBindNextKey'), btnResetNavKeys = $('btnResetNavKeys');
  var btnBindSaveKey = $('btnBindSaveKey'), btnResetSaveKey = $('btnResetSaveKey');
  var mouseSideSwitch = $('mouseSideSwitch');
  var btnBindPrevMouse = $('btnBindPrevMouse'), btnBindNextMouse = $('btnBindNextMouse'), btnResetMouseKeys = $('btnResetMouseKeys');
  var mouseClickNavSwitch = $('mouseClickNavSwitch');
  var counter = $('counter'), groupTag = $('groupTag'), filenameEl = $('filename');
  var dirtyDot = $('dirtyDot'), savedFlash = $('savedFlash');
  var viewer = $('viewer'), stage = $('stage');
  var viewerBottomBar = $('viewerBottomBar'), previewEl = $('preview'), btnBottomSave = $('btnBottomSave'), btnClearSecondary = $('btnClearSecondary'), btnCritical = $('btnCritical');
  var pathPanel = $('pathPanel'), pathTree = $('pathTree'), dirSummaryText = $('dirSummaryText'), btnBackToCurrent = $('btnBackToCurrent');
  var btnSyncOutput = $('btnSyncOutput');
  var btnFilterAll = $('btnFilterAll'), btnFilterMarked = $('btnFilterMarked');
  var btnFilterUnmarked = $('btnFilterUnmarked'), btnFilterUnviewed = $('btnFilterUnviewed');
  var sideCurLine = $('sideCurLine'), sideCurTower = $('sideCurTower'), sideCurLoc = $('sideCurLoc');
  var sideCurMarkedStatus = $('sideCurMarkedStatus'), sideCurViewedStatus = $('sideCurViewedStatus'), sideCurCriticalStatus = $('sideCurCriticalStatus');
  var leftResizer = $('leftResizer'), rightResizer = $('rightResizer'), side = $('side');
  var btnExpandAll = $('btnExpandAll'), btnCollapseAll = $('btnCollapseAll'), btnAutoFit = $('btnAutoFit');
  var baseCanvas = $('baseCanvas'), overlayCanvas = $('overlayCanvas');
  var baseCtx = baseCanvas.getContext('2d');
  var overlayCtx = overlayCanvas.getContext('2d');
  var empty = $('empty'), loadingEl = $('loading'), toastEl = $('toast');
  var sideScroll = $('sideScroll');
  var btnSettings = $('btnSettings'), settingsPanel = $('settingsPanel'), themeSwitch = $('themeSwitch');
  var btnOpenRecSettings = $('btnOpenRecSettings'), btnResetDefects = $('btnResetDefects'), btnClearViewedSettings = $('btnClearViewedSettings');
  var btnExportTemplateSettings = $('btnExportTemplateSettings'), btnImportTemplateSettings = $('btnImportTemplateSettings');
  var fileInput = $('fileInput'), templateFileInput = $('templateFileInput');

  // 二级界面：推荐规则与分类列表配置弹窗 DOM
  var recommendModal = $('recommendModal');
  var tabModalRec = $('tabModalRec'), tabModalCat = $('tabModalCat');
  var btnCloseRecModalTop = $('btnCloseRecModalTop'), btnCloseRecModal = $('btnCloseRecModal');
  var modalViewRec = $('modalViewRec'), modalViewCat = $('modalViewCat');

  // 目标部件与推荐关联 DOM
  var recPosSelect = $('recPosSelect'), btnCreateNewRecPos = $('btnCreateNewRecPos');
  var btnRenameCurRecPos = $('btnRenameCurRecPos'), btnDelCurRecPos = $('btnDelCurRecPos');
  var recTagContainer = $('recTagContainer'), btnClearAllCurRec = $('btnClearAllCurRec');
  var recAddCategorySelect = $('recAddCategorySelect'), recCustomAddInput = $('recCustomAddInput');
  var btnDoAddRec = $('btnDoAddRec'), recBiDirectionCheck = $('recBiDirectionCheck');

  // 候选分类池增删改 DOM
  var modalCandidateCloud = $('modalCandidateCloud'), candidatePoolCount = $('candidatePoolCount');
  var btnAddCandidateItem = $('btnAddCandidateItem'), btnToggleCandidateManage = $('btnToggleCandidateManage');
  var btnResetCandidatePool = $('btnResetCandidatePool'), candidatePoolHint = $('candidatePoolHint');

  var btnResetRecDefault = $('btnResetRecDefault');
  var btnExportRecModal = $('btnExportRecModal'), btnImportRecModal = $('btnImportRecModal');

  // 缺陷分类总表二级管理 DOM
  var modalCatSearchInput = $('modalCatSearchInput'), btnModalCreateCat = $('btnModalCreateCat');
  var modalCatListScroll = $('modalCatListScroll');

  // 导入确认弹窗相关 DOM
  var importModal = $('importModal');
  var importFileName = $('importFileName'), importCategoryCount = $('importCategoryCount');
  var importAdjacencyCount = $('importAdjacencyCount'), importExportTime = $('importExportTime');
  var btnCancelImport = $('btnCancelImport'), btnDoMergeImport = $('btnDoMergeImport'), btnDoOverwriteImport = $('btnDoOverwriteImport');
  var pendingImportData = null;

  /* ================= 工具 ================= */

  function mimeOf(name) {
    var e = name.slice(name.lastIndexOf('.')).toLowerCase();
    return e === '.png' ? 'image/png' : 'image/jpeg';
  }
  function getMeta(name) {
    var m = state.meta.get(name);
    if (!m) {
      m = { boxes: [], appended: [], history: [], saved: false };
      state.meta.set(name, m);
    }
    if (!m.history) m.history = [];
    return m;
  }
  function curName() { return state.index >= 0 ? state.files[state.index].id : null; }
  function curFile() { return state.index >= 0 ? state.files[state.index] : null; }

  if(window.desktopAPI&&desktopAPI.onProgress)desktopAPI.onProgress(function(p){if(ioBusy){loadingEl.textContent=p.phase+' '+p.done+' / '+p.total;loadingEl.style.display='';}});
  var toastTimer = null, toastHome = toastEl.parentElement;
  function toast(msg, ms, type) {
    (type === 'success' || type === 'error' ? document.body : toastHome).appendChild(toastEl);
    toastEl.classList.toggle('success', type === 'success');
    toastEl.classList.toggle('error', type === 'error');
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 1800);
  }
  var savedTimer = null;
  function flashSaved(msg) {
    savedFlash.textContent = msg || '已保存 ✓';
    savedFlash.classList.add('show');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { savedFlash.classList.remove('show'); }, 1500);
  }

  /* ================= 左右边栏拖拽调宽与智能自适应 ================= */

  function recomputeViewerStage() {
    if (state.index >= 0) {
      var c = state.cache.get(curName());
      if (c && c.img) {
        var fit = computeFit(c.img.naturalWidth, c.img.naturalHeight);
        fitView(fit.w, fit.h, fit.s);
        render();
      }
    }
  }

  function applyLeftWidth(w) {
    var minW = 240;
    var maxW = Math.max(minW, window.innerWidth - (rightWidth + 240));
    leftWidth = Math.min(maxW, Math.max(minW, Math.round(w)));
    pathPanel.style.width = leftWidth + 'px';
    pathPanel.style.flex = '0 0 ' + leftWidth + 'px';
    try { localStorage.setItem(KEY_LEFT_WIDTH, String(leftWidth)); } catch (e) {}
    recomputeViewerStage();
  }

  function applyRightWidth(w) {
    var minW = 240;
    var maxW = Math.max(minW, window.innerWidth - (leftWidth + 240));
    rightWidth = Math.min(maxW, Math.max(minW, Math.round(w)));
    side.style.width = rightWidth + 'px';
    side.style.flex = '0 0 ' + rightWidth + 'px';
    try { localStorage.setItem(KEY_RIGHT_WIDTH, String(rightWidth)); } catch (e) {}
    recomputeViewerStage();
  }

  var fitWidthSerial48=0;
  async function autoFitLeftPanelWidth() {
    if(!state.files.length)return;
    var source=state.files,serial=++fitWidthSerial48,cv=document.createElement('canvas'),ctx=cv.getContext('2d'),memo=new Map();
    var maxW=280,maxAllowed=Math.max(300,Math.floor(window.innerWidth*.55)),tick=performance.now();
    function measure(text,font,extra){var key=font+'\0'+text,v=memo.get(key);if(v===undefined){ctx.font=font+'px system-ui, sans-serif';v=ctx.measureText(text).width;memo.set(key,v);}return v+extra;}
    for(var i=0;i<source.length;i++){
      var f=source[i],p=parseFilePrefixAndLocation(f.name,f.relPath);
      maxW=Math.max(maxW,measure(p.prefix,'600 12',195),measure('【'+p.tower+'】','600 11.5',185),measure(p.loc,'12',115));
      if(maxW+15>=maxAllowed)break;
      if((i&127)===0&&performance.now()-tick>8){await yield46();tick=performance.now();if(serial!==fitWidthSerial48||state.files!==source)return;}
    }
    if(serial===fitWidthSerial48&&state.files===source)applyLeftWidth(Math.max(300,Math.min(maxAllowed,Math.ceil(maxW+15))));
    cv.width=cv.height=1;
  }

  function initResizers() {
    if (leftResizer) {
      var leftDragging = false, leftStartX = 0, leftStartW = 320;
      leftResizer.addEventListener('pointerdown', function (e) {
        fitWidthSerial48++;e.preventDefault();
        leftDragging = true;
        leftStartX = e.clientX;
        leftStartW = pathPanel.getBoundingClientRect().width;
        leftResizer.classList.add('dragging');
        document.body.classList.add('is-resizing');
        try { leftResizer.setPointerCapture(e.pointerId); } catch (err) {}
      });
      leftResizer.addEventListener('pointermove', function (e) {
        if (!leftDragging) return;
        Motion.resize('left', leftStartW + (e.clientX - leftStartX));
      });
      function stopLeft() {
        if (!leftDragging) return;
        leftDragging = false;
        leftResizer.classList.remove('dragging');
        document.body.classList.remove('is-resizing');
        invalidateCanvasRect();
      }
      leftResizer.addEventListener('pointerup', stopLeft);
      leftResizer.addEventListener('pointercancel', stopLeft);

      leftResizer.addEventListener('dblclick', function () {
        autoFitLeftPanelWidth();
        invalidateCanvasRect();
        toast('左侧栏已自动适配宽度');
      });
    }

    if (rightResizer) {
      var rightDragging = false, rightStartX = 0, rightStartW = 310;
      rightResizer.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        rightDragging = true;
        rightStartX = e.clientX;
        rightStartW = side.getBoundingClientRect().width;
        rightResizer.classList.add('dragging');
        document.body.classList.add('is-resizing');
        try { rightResizer.setPointerCapture(e.pointerId); } catch (err) {}
      });
      rightResizer.addEventListener('pointermove', function (e) {
        if (!rightDragging) return;
        Motion.resize('right', rightStartW - (e.clientX - rightStartX));
      });
      function stopRight() {
        if (!rightDragging) return;
        rightDragging = false;
        rightResizer.classList.remove('dragging');
        document.body.classList.remove('is-resizing');
        invalidateCanvasRect();
      }
      rightResizer.addEventListener('pointerup', stopRight);
      rightResizer.addEventListener('pointercancel', stopRight);
    }
  }

  /* ================= 智能线路/支线、子文件夹杆塔与位置精确提取（标准切分不漏字） ================= */

  var parsedFileCache = new Map();
  function parseFilePrefixAndLocation(filename, relPath) {
    var key = (relPath || '') + ':::' + (filename || '');
    var cached = parsedFileCache.get(key);
    if (cached) return cached;
    var res = _rawParseFilePrefixAndLocation(filename, relPath);
    parsedFileCache.set(key, res);
    return res;
  }

  var towerRegex = /(?:#\s*\d+(?:[-~_]\d+|[A-Za-z])?(?:号?[杆塔基]|#)?|\d+\s*#\s*(?:号?[杆塔基])(?!(?:支线|主线|联络线|专线|回线|线路|线))|\d+\s*#(?![\u4e00-\u9fa5\u2160-\u217fA-Za-z0-9_#]*(?:支线|主线|联络线|专线|回线|线路|线))|\d+\s*号(?:杆塔|[杆塔基])|\d+\s*(?:杆塔|[杆塔基])|第\s*\d+(?:[-~_]\d+|[A-Za-z])?\s*号?[杆塔基]|\d+[-~_]\d+(?:号?[杆塔基]|跨|档)|(?:[PTGNptgn]|Tower|Pole)\s*[-_]?\s*\d+(?:[-~_]\d+|[A-Za-z])?|^\d+(?:[-_]\d+)?$)/i;

  function parseDirToLineAndTower(dirPath, rootLineName) {
    var rel = String(dirPath || '').replace(/\\/g, '/');
    var parts = rel.split('/').filter(Boolean);
    var line = '';
    var tower = '';
    var rootName = rootLineName || savedInputName || (lastInputHandle && lastInputHandle.name) || '默认线路';

    if (parts.length >= 2) {
      var lastDir = parts[parts.length - 1].trim();
      var parentDir = parts[parts.length - 2].trim();
      var isLastTower = towerRegex.test(lastDir);
      var isParentTower = towerRegex.test(parentDir);
      if (isLastTower) {
        tower = lastDir;
        line = parentDir;
      } else if (isParentTower) {
        tower = parentDir;
        line = parts.length >= 3 ? parts[parts.length - 3].trim() : rootName;
      } else {
        tower = lastDir;
        line = parentDir;
      }
    } else if (parts.length === 1) {
      tower = parts[0].trim();
      line = rootName;
    } else {
      tower = '默认杆塔';
      line = rootName;
    }
    var towerNum = 999999;
    var numM = tower.match(/\d+/);
    if (numM) towerNum = parseInt(numM[0], 10);
    return { prefix: line || '默认线路', tower: tower || '默认杆塔', towerNum: towerNum };
  }

  function _rawParseFilePrefixAndLocation(filename, relPath) {
    var rawName = String(filename || '');
    var base = rawName.replace(/\.[^.]+$/, '');
    var rel = String(relPath || filename || '').replace(/\\/g, '/');
    var parts = rel.split('/').filter(Boolean);
    var dirParts = parts.slice(0, -1);

    var line = '';
    var tower = '';
    var towerNum = 999999;
    var rootLineName = savedInputName || (lastInputHandle && lastInputHandle.name) || '默认线路';

    // 1. 核心首选：直接以实际文件夹层级结构为准（用户现场规范：线路文件夹 / #001杆塔文件夹 / 照片）
    if (dirParts.length >= 2) {
      var lastDir = dirParts[dirParts.length - 1].trim();
      var parentDir = dirParts[dirParts.length - 2].trim();
      var isLastTower = towerRegex.test(lastDir);
      var isParentTower = towerRegex.test(parentDir);
      if (isLastTower) {
        tower = lastDir;
        line = parentDir;
      } else if (isParentTower) {
        tower = parentDir;
        line = dirParts.length >= 3 ? dirParts[dirParts.length - 3].trim() : rootLineName;
      } else {
        tower = lastDir;
        line = parentDir;
      }
    } else if (dirParts.length === 1) {
      tower = dirParts[0].trim();
      line = rootLineName;
    }

    // 2. 若目录未体现杆塔，从文件名安全提取杆塔
    if (!tower || tower === '默认杆塔') {
      var isCameraSeq = /^(?:DJI|IMG|DSC|DCIM|PANO|VID|SCREENSHOT|QQ图片|微信图片)/i.test(base);
      var segs = base.split(/[_\-—\s]+/).filter(Boolean);
      for (var j = 0; j < segs.length; j++) {
        var s = segs[j];
        var stm = s.match(towerRegex);
        if (stm && (stm[0] === s || /^[#PTGN\d]/i.test(s))) {
          tower = stm[0].replace(/\s+/g, '');
          break;
        } else if (!isCameraSeq && /^\d+$/.test(s) && (j === 0 || j === 1)) {
          var n = parseInt(s, 10);
          tower = '#' + (s.length >= 3 ? s : (n < 10 ? '0' + n : n));
          break;
        }
      }
      if (!tower) {
        var rawTm = base.match(towerRegex);
        if (rawTm) tower = rawTm[0].replace(/\s+/g, '');
      }
    }

    // 3. 若仍无线路，检查文件名
    if (!line || line === '默认线路') {
      var lineVolRegex = /(?:(?:10|35|110|220|500|750|1000)\s*(?:k|kV|KV|千伏)[\u4e00-\u9fa5\u2160-\u217fA-Za-z0-9_#\-\(\)（）]*?(?:支线|主线|联络线|专线|回线|备用线|电缆线|线路|线|工程))/i;
      var lineGenRegex = /[\u4e00-\u9fa5\u2160-\u217fA-Za-z0-9_#\-\(\)（）]{2,}?(?:支线|主线|联络线|专线|回线|备用线|电缆线|线路|工程)/;
      var cleanForLine = base.replace(/(?:导线|避雷线|接地线|地线|引流线|拉线|跳线)(?:线夹|绑带|连接)?/g, '');
      var fLm = cleanForLine.match(lineVolRegex) || cleanForLine.match(lineGenRegex);
      if (fLm) line = fLm[0].trim();
      else line = rootLineName;
    }

    if (tower) {
      var numM = tower.match(/\d+/);
      if (numM) towerNum = parseInt(numM[0], 10);
    } else {
      tower = '默认杆塔';
    }

    // 4. 提取位置部件 loc（去掉线路和杆塔后剩余的纯部件文字，如 大号侧通道、杆号牌）
    var locClean = base;
    if (line && line !== '默认线路') locClean = locClean.split(line).join('');
    if (tower && tower !== '默认杆塔') locClean = locClean.split(tower).join('');
    locClean = locClean.replace(/^10k[Vv]?[\u4e00-\u9fa5\u2160-\u217f0-9_#\-]+?__/i, '');
    locClean = locClean.replace(/^[_\-—\s#]+|[_\-—\s#]+$/g, '').trim();

    return {
      prefix: line || '默认线路',
      tower: tower,
      towerNum: towerNum,
      loc: locClean || base
    };
  }

  /* ================= 打开文件夹 ================= */

  function extractGroup(name) {
    var m = name.match(/#(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  async function scanImagesRecursive(dirHandle,out,prefix,parentHandle){
    prefix=prefix||'';if(!prefix)dirRegistry.clear();
    var queue=[{h:dirHandle,p:prefix,parent:parentHandle}],head=0,active=0,error=null,lastPaint=0;
    return new Promise(function(resolve,reject){
      async function scan(job){
        dirRegistry.set(job.p,{handle:job.h,parentHandle:job.parent||null,name:job.h.name});
        for await(var pair of job.h.entries()){
          var name=pair[0],handle=pair[1];
          if(handle.kind==='directory'){
            if([DIR_BOX,DIR_ORIG,DIR_CRIT].includes(name)||name.startsWith('.'))continue;
            var next=job.p+name+'/';state.discoveredDirs.push(next);queue.push({h:handle,p:next,parent:job.h});
          }else if(handle.kind==='file'&&IMG_EXTS.includes(name.slice(name.lastIndexOf('.')).toLowerCase())){
            out.push({name:name,handle:handle,file:null,mime:mimeOf(name),relPath:job.p+name,group:extractGroup(name)});
          }
          if(performance.now()-lastPaint>120){lastPaint=performance.now();loadingEl.textContent='发现 '+out.length.toLocaleString()+' 张照片…';await yield46();}
        }
      }
      function pump(){
        while(!error&&active<4&&head<queue.length){var job=queue[head++];active++;
          scan(job).catch(function(e){error=e;}).finally(function(){active--;pump();});
        }
        if(!active&&(error||head===queue.length)){loadingEl.textContent='加载中…';if(error)reject(error);else resolve();}
      }pump();
    });
  }
  async function sortPhotos48(entries){
    var chunk=1024,n=entries.length,src=entries,dst=new Array(n);
    for(var start=0;start<n;start+=chunk){var part=entries.slice(start,start+chunk).sort(comparePhotos);for(var k=0;k<part.length;k++)entries[start+k]=part[k];await yield46();}
    for(var width=chunk;width<n;width*=2){
      var tick=performance.now();
      for(var start=0;start<n;start+=width*2){
        var mid=Math.min(start+width,n),end=Math.min(start+width*2,n),a=start,b=mid;
        for(var k=start;k<end;k++){dst[k]=a<mid&&(b>=end||comparePhotos(src[a],src[b])<=0)?src[a++]:src[b++];if((k&2047)===0&&performance.now()-tick>8){await yield46();tick=performance.now();}}
        if(performance.now()-tick>8){await yield46();tick=performance.now();}
      }var swap=src;src=dst;dst=swap;
    }
    if(src!==entries)for(var i=0;i<n;i++)entries[i]=src[i];
  }

  function updateFolderButtonText() {
    if (state.files.length > 0) {
      var name = (lastInputHandle ? lastInputHandle.name : '') || savedInputName || '已打开';
      if (inputFolderBtnText) {
        inputFolderBtnText.textContent = name;
      }
      btnFolder.title = '当前输入目录：' + name + '（点击更换文件夹，右键强制打开选择器）';
    } else if (savedInputName) {
      if (inputFolderBtnText) {
        inputFolderBtnText.innerHTML = '恢复: <b style="color:var(--accent)">' + esc(savedInputName) + '</b>';
      }
      btnFolder.title = '上次打开目录：' + savedInputName + '（点击直接恢复连接，右键更换新目录）';
    } else {
      if (inputFolderBtnText) {
        inputFolderBtnText.textContent = '未选择';
      }
      btnFolder.title = '点击选择包含巡检照片的输入文件夹';
    }
  }

  function updateEmptyScreenRestoreButton() {
    if (btnEmptyRestore && emptyRestoreDirName) {
      var name = savedInputName || (lastInputHandle ? lastInputHandle.name : '');
      if (name) {
        emptyRestoreDirName.textContent = name;
        btnEmptyRestore.style.display = 'inline-flex';
        btnEmptyPick.textContent = '选择其他文件夹';
        btnEmptyPick.classList.remove('primary');
      } else {
        btnEmptyRestore.style.display = 'none';
        btnEmptyPick.textContent = '选择输入文件夹';
        btnEmptyPick.classList.add('primary');
      }
    }
  }

  async function pickFolder(forceNewPicker) {
    if(ioBusy||saveQueueBusy48()||state.navBusy){toast('请等待保存任务完成');return;}
    if (!window.showDirectoryPicker) {
      toast('目录接口未就绪，请关闭并重新打开程序');
      return;
    }

    // 1. 如果未指定强制重新选择，且已有记忆的输入目录句柄，直接尝试一键重新连接恢复
    if (!forceNewPicker && lastInputHandle && state.files.length === 0) {
      try {
        var status = await lastInputHandle.queryPermission({ mode: 'readwrite' });
        if (status !== 'granted') {
          status = await lastInputHandle.requestPermission({ mode: 'readwrite' });
        }
        if (status === 'granted') {
          loadingEl.style.display = '';
          state.discoveredDirs = [];
          var entries = [];
          await scanImagesRecursive(lastInputHandle, entries, '');
          loadingEl.style.display = 'none';
          if (entries.length > 0) {
            await setupFiles(entries, 'fs', lastInputHandle);
            toast('✓ 已恢复打开记忆的输入目录：' + lastInputHandle.name);
            return;
          } else {
            toast('该记忆目录下未找到照片，请重新选择');
          }
        }
      } catch (e) {
        loadingEl.style.display = 'none';
        console.warn('恢复上次输入目录失败，将打开目录选择器:', e);
      }
    }

    // 2. 弹出系统目录选择器（自动定位在上次打开的目录）
    try {
      var pickerOpts = { mode: 'readwrite' };
      if (lastInputHandle) pickerOpts.startIn = lastInputHandle;
      var handle = await window.showDirectoryPicker(pickerOpts);
      loadingEl.style.display = '';
      state.discoveredDirs = [];
      var entries2 = [];
      await scanImagesRecursive(handle, entries2, '');
      loadingEl.style.display = 'none';
      if (entries2.length === 0 && (!state.discoveredDirs || state.discoveredDirs.length === 0)) {
        toast('该目录下没有找到任何子文件夹或 jpg/jpeg/png 图片');
        return;
      }
      await setupFiles(entries2, 'fs', handle);
      toast('✓ 已打开输入目录：' + handle.name);
    } catch (err) {
      loadingEl.style.display = 'none';
      if (err && err.name === 'AbortError') return;
      toast('无法打开文件夹：' + (err && err.message || err));
    }
  }

  function dirOf(p) {
    var i = p.lastIndexOf('/');
    return i < 0 ? '' : p.slice(0, i);
  }

  var naturalCollator48=new Intl.Collator('zh-CN',{numeric:true,sensitivity:'base'});
  function comparePhotos(a, b) {
    var pa = parseFilePrefixAndLocation(a.name, a.relPath);
    var pb = parseFilePrefixAndLocation(b.name, b.relPath);

    // 1. 严格按线路名称自然升序排序
    var lineCmp = naturalCollator48.compare(pa.prefix,pb.prefix);
    if (lineCmp !== 0) return lineCmp;

    // 2. 核心：严格按杆塔数字编号升序排序（避免 #1, #10, #2，确保 #1 -> #2 -> #3 -> #10 顺序连贯）
    if (pa.towerNum !== pb.towerNum) {
      return pa.towerNum - pb.towerNum;
    }

    // 3. 杆塔名称字面自然比较（如 #036 < #036-1 < #036-2 < #037）
    var towerCmp = naturalCollator48.compare(pa.tower,pb.tower);
    if (towerCmp !== 0) return towerCmp;

    // 4. 同一杆塔内的照片，按目录层级与文件名自然排序
    var da = dirOf(a.relPath || a.name);
    var db = dirOf(b.relPath || b.name);
    var dirCmp = naturalCollator48.compare(da,db);
    if (dirCmp !== 0) return dirCmp;

    return naturalCollator48.compare(a.name,b.name);
  }

  async function setupFiles(entries, mode, handle) {
    if(ioBusy||saveQueueBusy48())return;
    if(window.desktopAPI)await saveDrafts50();
    clearTimeout(directoryTimer43);directoryQuery43='';directoryTerms43=[];directorySnapshot43=null;directoryCache43=new WeakMap();if($('directorySearch'))$('directorySearch').value='';if($('btnClearDirectorySearch'))$('btnClearDirectorySearch').hidden=true;
    await viewedReady48;
    await assignPhotoIdentities(entries, handle);
    if (handle) {
      lastInputHandle = handle;
      savedInputName = handle.name;
      try { localStorage.setItem(KEY_INPUT_NAME, handle.name); } catch (e) {}
      saveDirHandle('last_input_handle', handle);
    }

    // 彻底过滤掉任何属于「缺陷圈示图」或「缺陷原图」目录的图片文件，确保列表全为真正独立的待检原图
    entries = entries.filter(function (e) {
      var p = (e.relPath || e.name || '');
      return p.indexOf('缺陷圈示图') < 0 && p.indexOf('缺陷原图') < 0 && p.indexOf('危急缺陷') < 0;
    });

    if (!state.discoveredDirs || state.discoveredDirs.length === 0) {
      var dirSet = new Set();
      for (var fi = 0; fi < entries.length; fi++) {
        var p = entries[fi].relPath || '';
        var idx = p.lastIndexOf('/');
        if (idx > 0) {
          dirSet.add(p.slice(0, idx + 1));
        }
      }
      state.discoveredDirs = Array.from(dirSet);
    }

    // 必须在排序前清空缓存，保证 comparePhotos 使用最新的 rootLineName 和解析结果
    parsedFileCache.clear();
    await sortPhotos48(entries);

    clearCache();
    collapsedGroups.clear();
    collapsedTowers.clear();
    filterMode = 'all';
    btnFilterAll.classList.add('active');
    btnFilterMarked.classList.remove('active');
    btnFilterUnmarked.classList.remove('active');
    btnFilterUnviewed.classList.remove('active');
    state.mode = mode;
    state.files = entries;
    state.byName = new Map();
    state.indexByName = new Map();
    state.meta = new Map();
    state.markedFiles = new Set();
    state.markedBoxedHandles = new Map();
    state.markedDefectTags = new Map();
    state.markedCounts = new Map();
    state.criticalFiles = new Set();
    for (var i = 0; i < entries.length; i++) {
      state.byName.set(entries[i].id, entries[i]);
      state.indexByName.set(entries[i].id, i);
    }
    if(window.desktopAPI)await restoreDrafts50();
    state.index = -1;
    empty.style.display = 'none';
    if (viewerBottomBar) viewerBottomBar.style.display = 'flex';

    updateFolderButtonText();

    if (output.mainHandle) {
      await scanOutputDirectory();
    } else {
      renderPathTree(false);
    }

    autoFitLeftPanelWidth();
    await switchTo(0);
  }

  // clearCache: implementation in i35 reliability section.


  /* ================= 图片加载 / 缓存 ================= */

  // loadImageElement: implementation in i35 reliability section.

  // getImage: implementation in i35 reliability section.

  // evictLRU: implementation in i35 reliability section.

  // preload: implementation in i35 reliability section.


  /* ================= 视图渲染 ================= */

  var cachedCanvasRect = null;
  function getCanvasRect() {
    if (!cachedCanvasRect) {
      cachedCanvasRect = overlayCanvas.getBoundingClientRect();
    }
    return cachedCanvasRect;
  }
  function invalidateCanvasRect() {
    cachedCanvasRect = null;
  }
  window.addEventListener('resize', invalidateCanvasRect);

  function computeFit(nw, nh) {
    var pad = 12;
    var availW = Math.max(10, viewer.clientWidth - pad * 2);
    var availH = Math.max(10, viewer.clientHeight - pad * 2 - Math.max(75,viewerBottomBar.offsetHeight||0));
    var s = Math.min(1, availW / nw, availH / nh);
    return { w: nw * s, h: nh * s, s: s };
  }
  function fitView(w, h, s) {
    invalidateCanvasRect();
    var dpr = window.devicePixelRatio || 1;
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    var pixelW=Math.max(1,Math.round(w*dpr)),pixelH=Math.max(1,Math.round(h*dpr));
    if(baseCanvas.width!==pixelW)baseCanvas.width=pixelW;if(baseCanvas.height!==pixelH)baseCanvas.height=pixelH;
    if(overlayCanvas.width!==pixelW)overlayCanvas.width=pixelW;if(overlayCanvas.height!==pixelH)overlayCanvas.height=pixelH;
    baseCanvas.style.width = w + 'px'; baseCanvas.style.height = h + 'px';
    overlayCanvas.style.width = w + 'px'; overlayCanvas.style.height = h + 'px';
    state.view = { w: w, h: h, s: s, zoom: 1, panX: 0, panY: 0, cx: w / 2, cy: h / 2 };
  }
  function currentImage() {
    var name = curName();
    if (!name) return null;
    var c = state.cache.get(name);
    return c ? c.img : null;
  }
  function setViewTransform(ctx) {
    var v = state.view;
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(v.cx + v.panX, v.cy + v.panY);
    ctx.scale(v.zoom, v.zoom);
    ctx.translate(-v.cx, -v.cy);
  }
  function renderBase() {
    var v = state.view;
    var dpr = window.devicePixelRatio || 1;
    var img = currentImage();
    baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseCtx.clearRect(0, 0, v.w, v.h);
    if (img) { setViewTransform(baseCtx); baseCtx.drawImage(img.bitmap || img, 0, 0, v.w, v.h); }
  }
  function renderOverlay() {
    var v = state.view;
    if (!v || !v.w) return;
    var dpr = window.devicePixelRatio || 1;
    overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    overlayCtx.clearRect(0, 0, v.w, v.h);
    setViewTransform(overlayCtx);
    overlayCtx.strokeStyle = '#FF0000';
    overlayCtx.lineWidth = strokeWidth * v.s;
    overlayCtx.lineJoin = 'miter';
    var name = curName();
    var c = name ? state.cache.get(name) : null;
    var isBoxedImg = c && c.isBoxed;
    var m = name ? getMeta(name) : null;
    var boxes = m ? m.boxes : null;
    if (boxes) {
      // 已保存的圈示图会把之前的红框直接烘焙进图片本身；
      // 这里只需要额外绘制"烘焙之后"新增/未保存的红框，避免旧框重复绘制，
      // 同时也避免了保存后继续新增红框却不显示的问题。
      var bakedCount = (isBoxedImg && !m.isSecondaryEdit) ? (c.bakedCount || 0) : 0;
      for (var i = bakedCount; i < boxes.length; i++) overlayCtx.strokeRect(boxes[i].x * v.s, boxes[i].y * v.s, boxes[i].w * v.s, boxes[i].h * v.s);
      if (selectedIndex >= 0 && selectedIndex < boxes.length && selectedIndex >= bakedCount) drawHandles(overlayCtx, boxes[selectedIndex], v);
    }
    if (mode === 'draw' && dragBox) { var n = normalize(dragBox); overlayCtx.strokeRect(n.x * v.s, n.y * v.s, n.w * v.s, n.h * v.s); }
  }

  function drawHandles(ctx, b, v) {
    var s = v.s, hs = HANDLE_PX / v.zoom, hw = hs / 2;
    var cx = b.x * s, cy = b.y * s, x2 = b.x * s + b.w * s, y2 = b.y * s + b.h * s;
    var pts = [[cx,cy],[x2,cy],[cx,y2],[x2,y2],[(cx+x2)/2,cy],[(cx+x2)/2,y2],[cx,(cy+y2)/2],[x2,(cy+y2)/2]];
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#FF0000'; ctx.lineWidth = 1.5 / v.zoom;
    for (var i = 0; i < pts.length; i++) {
      ctx.fillRect(pts[i][0]-hw, pts[i][1]-hw, hs, hs);
      ctx.strokeRect(pts[i][0]-hw, pts[i][1]-hw, hs, hs);
    }

    var btnR = 10 / v.zoom;
    var btnX = x2 + btnR + 2 / v.zoom;
    var btnY = cy - btnR - 2 / v.zoom;
    ctx.beginPath();
    ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
    ctx.fillStyle = '#c62828';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 / v.zoom;
    ctx.stroke();

    var cross = 4.5 / v.zoom;
    ctx.beginPath();
    ctx.moveTo(btnX - cross, btnY - cross);
    ctx.lineTo(btnX + cross, btnY + cross);
    ctx.moveTo(btnX + cross, btnY - cross);
    ctx.lineTo(btnX - cross, btnY + cross);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / v.zoom;
    ctx.stroke();
  }
  function render() { renderBase(); renderOverlay(); }

  /* ================= 位置提取与相近关联图谱匹配 ================= */

  function detectLocation(name) {
    var raw = displayName(name);
    var parsed = parseFilePrefixAndLocation(raw, '');
    var targetLoc = parsed.loc;

    for (var i = 0; i < KNOWN_POSITIONS.length; i++) {
      var kp = KNOWN_POSITIONS[i];
      if (targetLoc === kp || targetLoc.indexOf(kp) >= 0) {
        return kp;
      }
    }

    return targetLoc || raw.replace(/\.[^.]+$/, '');
  }

  function getRelatedPositions(loc) {
    if (!loc) return [];
    var related = [];
    var added = {};
    added[loc] = true;

    if (locationAdjacency[loc]) {
      var direct = locationAdjacency[loc];
      for (var i = 0; i < direct.length; i++) {
        if (!added[direct[i]]) {
          related.push(direct[i]);
          added[direct[i]] = true;
        }
      }
    }

    for (var key in locationAdjacency) {
      if (loc.indexOf(key) >= 0 || key.indexOf(loc) >= 0) {
        var subDirect = locationAdjacency[key];
        for (var j = 0; j < subDirect.length; j++) {
          if (!added[subDirect[j]]) {
            related.push(subDirect[j]);
            added[subDirect[j]] = true;
          }
        }
      }
    }

    return related;
  }

  /* ================= 筛选匹配与上一张/下一张定位核心辅助 ================= */

  function isFileMatchingFilter(idx) {
    if (idx < 0 || !state.files || idx >= state.files.length) return false;
    if (filterMode === 'all') return true;
    var f = state.files[idx];
    var isMarked = !!(state.markedFiles && state.markedFiles.has(f.id));
    var isViewed = !!viewedPhotosMap[f.id];
    if (filterMode === 'marked') return isMarked;
    if (filterMode === 'unmarked') return !isMarked;
    if (filterMode === 'unviewed') return !isViewed;
    return true;
  }

  // getNextFilteredIndex: i38 performance implementation below.


  function updateHud() {
    if(window.desktopAPI)scheduleDrafts50();
    updateCompactPhoto43();
    updateReviewUI();if(SaveQueue48)SaveQueue48.paint();
    if (state.index < 0) {
      counter.textContent = '— / —'; groupTag.textContent = ''; filenameEl.textContent = '';
      dirtyDot.style.display = 'none'; btnPrev.disabled = btnNext.disabled = true;
      if (sideCurMarkedStatus) sideCurMarkedStatus.textContent = '—';
      if (sideCurCriticalStatus) sideCurCriticalStatus.textContent = '—';
      updateCriticalButtonState(false);
      if (btnBackToCurrent) btnBackToCurrent.style.display = 'none';
      return;
    }
    var f = state.files[state.index];
    var parsed = parseFilePrefixAndLocation(f.name, f.relPath);

    // 筛选状态下动态统计当前过滤集合内的位置和总数
    if (filterMode !== 'all') {
      var stats38=FastIndex.position(state.index),filterCount=stats38.count,filterPos=stats38.pos;
      var filterNames = { marked: '已标记', unmarked: '未标记', unviewed: '未看' };
      var fLabel = filterNames[filterMode] || '筛选';
      counter.textContent = (filterPos > 0 ? filterPos : '—') + ' / ' + filterCount + ' [' + fLabel + ']';
      counter.title = '当前在【' + fLabel + '】筛选下：第 ' + filterPos + ' / 共 ' + filterCount + ' 张（总序列第 ' + (state.index + 1) + ' / ' + state.files.length + ' 张）';
    } else {
      counter.textContent = (state.index + 1) + ' / ' + state.files.length;
      counter.title = '第 ' + (state.index + 1) + ' / 共 ' + state.files.length + ' 张照片';
    }

    var isCurPhotoMarked = (state.markedFiles && state.markedFiles.has(f.id));
    var curDefectTag = isCurPhotoMarked ? getDefectTagsForFile(f.id) : '';

    groupTag.textContent = '【' + parsed.prefix + ' · ' + parsed.tower + '】';
    if (curDefectTag) {
      filenameEl.innerHTML = esc(f.name) + '<span style="color:var(--accent);font-weight:600;margin-left:4px" title="已标缺陷标签">' + esc(curDefectTag) + '</span>';
    } else {
      filenameEl.textContent = f.name;
    }
    filenameEl.title = f.relPath || f.name;

    var m = getMeta(f.id);
    dirtyDot.style.display = (m.boxes && m.boxes.length > 0 && !m.saved) ? '' : 'none';

    // 上一张/下一张按钮根据当前筛选集合智能判断是否可点击
    var hasPrev = getNextFilteredIndex(requestedIndex >= 0 ? requestedIndex : state.index, -1) >= 0;
    var hasNext = getNextFilteredIndex(requestedIndex >= 0 ? requestedIndex : state.index, 1) >= 0;
    btnPrev.disabled = !hasPrev;
    btnNext.disabled = !hasNext;

    if (sideCurLine) sideCurLine.textContent = parsed.prefix;
    if (sideCurTower) sideCurTower.textContent = parsed.tower;
    if (sideCurLoc) {
      sideCurLoc.innerHTML = esc(parsed.loc) + (curDefectTag ? (' <span style="color:var(--accent);font-weight:600">' + esc(curDefectTag) + '</span>') : '');
    }
    if (sideCurMarkedStatus) {
      if (isCurPhotoMarked) {
        var cImg = state.cache.get(f.id);
        var isViewingBoxed = cImg && cImg.isBoxed;
        var toggleBtn = '<button id="btnToggleBoxedView" class="mini-tool-btn" type="button" style="color:' + (isViewingBoxed ? 'var(--text)' : 'var(--accent)') + ';font-size:10px;padding:0 5px;height:18px;margin-left:4px;display:inline-flex;align-items:center" title="' + (isViewingBoxed ? '当前显示为缺陷圈示图，点击查看纯净原图' : '当前显示为原图，点击切换至缺陷圈示图') + '">' + (isViewingBoxed ? '查看原图' : '查看圈示图') + '</button>';
        if (!state.markedBoxedHandles.has(f.id)) toggleBtn = '';
        sideCurMarkedStatus.innerHTML = '<span style="color:var(--accent);font-weight:600">已标记' + (isViewingBoxed ? ' (圈示图)' : ' (原图)') + '</span>' + toggleBtn + ' <button id="btnCancelCurrentMarked" class="mini-tool-btn" type="button" style="color:var(--accent);font-size:10px;padding:0 5px;height:18px;margin-left:4px;border-color:var(--accent);display:inline-flex;align-items:center;gap:3px" title="取消当前图片的缺陷标记，并从输出目录中撤回对应的缺陷圈示图、缺陷原图及危急缺陷图片"><svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2" fill="none" style="display:block"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>取消已标</button>';
        var cancelBtn = document.getElementById('btnCancelCurrentMarked');
        if (cancelBtn) {
          cancelBtn.onclick = function () {
            cancelMarkedDefect(state.index);
          };
        }
        var toggleEl = document.getElementById('btnToggleBoxedView');
        if (toggleEl) {
          toggleEl.onclick = function () { return withIO(async function () {
            var curCached = state.cache.get(f.id);
            var wantClean = curCached && curCached.isBoxed;
            loadingEl.style.display = '';
            try {
              var newC = await getImage(state.index, wantClean);
              state.natural = { w: newC.img.naturalWidth, h: newC.img.naturalHeight };
              var nFit = computeFit(newC.img.naturalWidth, newC.img.naturalHeight);
              fitView(nFit.w, nFit.h, nFit.s);
              render();
              updateHud();
              toast(wantClean ? '已切换至纯净原图' : '已切换至缺陷圈示图');
            } catch (err) {
              toast('切换视图失败：' + (err && err.message || err));
            } finally {
              loadingEl.style.display = 'none';
            }
          }); };
        }
      } else {
        sideCurMarkedStatus.innerHTML = '<span style="color:var(--muted)">未标记</span>';
      }
    }

    if (sideCurViewedStatus) {
      var isCurPhotoViewed = !!viewedPhotosMap[f.id];
      if (isCurPhotoViewed) {
        sideCurViewedStatus.innerHTML = '<span style="color:var(--ok);font-weight:600">已看</span>';
      } else {
        sideCurViewedStatus.innerHTML = '<span style="color:var(--warn)">未看</span>';
      }
    }

    var isCurPhotoCritical = !!(state.criticalFiles && state.criticalFiles.has(f.id));
    if (sideCurCriticalStatus) {
      if (isCurPhotoCritical) {
        sideCurCriticalStatus.innerHTML = '<span style="color:#d9860f;font-weight:600">已存危急</span> <button id="btnCancelCurrentCritical" class="mini-tool-btn" type="button" style="color:#d9860f;font-size:10px;padding:0 5px;height:18px;margin-left:4px;border-color:#d9860f;display:inline-flex;align-items:center;gap:3px" title="撤回危急缺陷保存，仅从「危急缺陷」文件夹删除对应文件"><svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2" fill="none" style="display:block"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>撤回</button>';
        var cancelCritBtn = document.getElementById('btnCancelCurrentCritical');
        if (cancelCritBtn) {
          cancelCritBtn.onclick = function () {
            cancelCriticalOnly(curName());
          };
        }
      } else {
        sideCurCriticalStatus.innerHTML = '<span style="color:var(--muted)">未保存</span>';
      }
    }
    updateCriticalButtonState(isCurPhotoCritical);
    if (btnBackToCurrent) {
      btnBackToCurrent.style.display = (state.files && state.files.length > 0) ? 'inline-flex' : 'none';
      var lastVIdx = FastIndex.last();
      if (lastVIdx >= 0) {
        var lastVF = state.files[lastVIdx];
        var lastVParsed = parseFilePrefixAndLocation(lastVF.name, lastVF.relPath);
        btnBackToCurrent.title = '直达最后一个已看照片：' + lastVParsed.tower + ' · ' + lastVParsed.loc + ' (第 ' + (lastVIdx + 1) + '/' + state.files.length + ' 张，快捷键: C)';
      } else {
        btnBackToCurrent.title = '直达最后一个已看照片 (快捷键: C)';
      }
    }
  }

  /* ================= 输出目录扫描（获取已标记照片信息） ================= */

  function purgeOutputArtifactsFromFiles() {
    if (!state.files || state.files.length === 0) return false;
    var hasArtifacts = state.files.some(function (f) {
      var p = (f.relPath || f.name || '');
      return p.indexOf('缺陷圈示图') >= 0 || p.indexOf('缺陷原图') >= 0;
    });
    if (!hasArtifacts) return false;

    state.files = state.files.filter(function (f) {
      var p = (f.relPath || f.name || '');
      return p.indexOf('缺陷圈示图') < 0 && p.indexOf('缺陷原图') < 0;
    });
    state.byName = new Map();
    state.indexByName = new Map();
    for (var i = 0; i < state.files.length; i++) {
      state.byName.set(state.files[i].id, state.files[i]);
      state.indexByName.set(state.files[i].id, i);
    }
    if (state.index >= state.files.length) state.index = state.files.length - 1;
    return true;
  }

  function extractDefectTag(origName, outName) {
    if (!origName || !outName) return '';
    var origBase = origName.slice(0, origName.lastIndexOf('.'));
    var outBase = outName.slice(0, outName.lastIndexOf('.'));

    if (outBase === origBase) return '';
    if (outBase.startsWith(origBase + '_')) {
      return outBase.slice(origBase.length);
    }
    var idx = outBase.lastIndexOf(origBase);
    if (idx >= 0) {
      var after = outBase.slice(idx + origBase.length);
      if (after.startsWith('_')) return after;
    }
    var parts = outBase.split('__');
    var lastPart = parts[parts.length - 1];
    var subParts = lastPart.split('_');
    if (subParts.length > 1) {
      return '_' + subParts.slice(1).join('_');
    }
    return '';
  }

  function getDefectTagsForFile(name) {
    if (!name) return '';
    var m = state.meta.get(name);
    if (m && m.appended && m.appended.length > 0) {
      return m.appended.join('');
    }
    if (state.markedDefectTags && state.markedDefectTags.has(name)) {
      return state.markedDefectTags.get(name);
    }
    return '';
  }

  /* 独立扫描「危急缺陷」文件夹，得到已独立保存过危急缺陷的原始文件名集合（与主标记统计完全分离） */
  // scanCriticalDirectory: implementation in i35 reliability section.


  // scanOutputDirectory: implementation in i35 reliability section.


  if (btnSyncOutput) {
    btnSyncOutput.addEventListener('click', function () {
      if(ioBusy||saveQueueBusy48()||state.navBusy){toast('请等待保存任务完成');return;}
      if (!output.mainHandle) {
        selectOutputDir();
        return;
      }
      withIO(function(){return scanOutputDirectory();});
    });
  }

  if($('btnSyncOutputSettings'))$('btnSyncOutputSettings').addEventListener('click',function(){toggleSettings39(false);btnSyncOutput.click();});

  /* ================= 一键从「缺陷圈示图」匹配生成「缺陷原图」 ================= */

  // createOriginalPhotosFromBoxed: implementation in i35 reliability section.


  if (btnCreateOrigFromBoxed) {
    btnCreateOrigFromBoxed.addEventListener('click', function () {
      createOriginalPhotosFromBoxed();
    });
  }

  /* ================= 规范化输出文件夹缺陷命名（去除模板多余数字编号） ================= */

  function cleanDefectFileName(name) {
    if (!name || typeof name !== 'string') return name;
    var visibleName = displayName(name);
    var ext = visibleName.slice(visibleName.lastIndexOf('.'));
    var base = visibleName.slice(0, visibleName.lastIndexOf('.'));

    // 文件名由下划线分割：线路前缀(0) _ 杆塔号(1) _ 部件位置(2) _ 缺陷描述(3...)
    // 严格只修改第 2 段（部件位置，如将 _变压器 (2)_ 清洗为 _变压器_），其余线路名、杆塔号、缺陷描述完全保持原样不动
    var parts = base.split('_');
    if (parts.length < 3) {
      return name;
    }

    // 仅精准清洗 parts[2]（部件位置）中尾部的空格、括号、数字与符号
    parts[2] = parts[2].replace(/[\s（\(【\[#\-_]*[\d一二三四五六七八九十]+[\s）\)】\]#\-_]*$/, '');

    return parts.join('_') + ext;
  }

  // checkAndCleanOutputDefectNames: implementation in i35 reliability section.


  if (btnCleanDefectNames) {
    btnCleanDefectNames.addEventListener('click', function () {
      checkAndCleanOutputDefectNames();
    });
  }

  if (btnClassifyInsulation) {
    btnClassifyInsulation.addEventListener('click', function () {
      classifyDefectsIntoInsulationFolders();
    });
  }
  if (btnClassifyInsulationMenu) {
    btnClassifyInsulationMenu.addEventListener('click', function () {
      classifyDefectsIntoInsulationFolders();
    });
  }
  if (btnClassifyInsulationSettings) {
    btnClassifyInsulationSettings.addEventListener('click', function () {
      settingsPanel.classList.remove('show');
      classifyDefectsIntoInsulationFolders();
    });
  }

  /* ================= 删除指定原始照片在输出目录中已保存的所有缺陷文件 ================= */

  // deleteExistingDefectOutputs: implementation in i35 reliability section.


  /* ================= 取消缺陷标记并删除输出目录对应文件 ================= */

  async function cancelMarkedDefectImpl(target) {
    var origName = '';
    var idx = -1;
    if (typeof target === 'number') {
      idx = target;
      if (state.files && state.files[idx]) {
        origName = state.files[idx].id;
      }
    } else if (typeof target === 'string') {
      origName = target;
      if (state.files) {
        for (var i = 0; i < state.files.length; i++) {
          if (state.files[i].id === origName) {
            idx = i;
            break;
          }
        }
      }
    } else {
      origName = curName();
      idx = state.index;
    }

    if (!origName) {
      toast('未选择任何图片');
      return;
    }

    var isMarked = (state.markedFiles && state.markedFiles.has(origName)) || (state.criticalFiles && state.criticalFiles.has(origName));
    if (!isMarked) {
      toast('该图片尚未标记为缺陷图片');
      return;
    }

    var confirmed = await showConfirmDialog(
      '取消标记确认',
      '确定要取消「' + displayName(origName) + '」的缺陷标记，并将对应的圈示图、原图和危急缺陷图移入成果回收站吗？'
    );
    if (!confirmed) return;

    loadingEl.style.display = '';
    try {
      // 1. 在输出目录（缺陷圈示图、缺陷原图、危急缺陷）中查找并删除该照片的所有已输出文件
      var deletedCount = await deleteExistingDefectOutputs(origName);

      // 2. 清除该照片在内存中的标记状态与缺陷标签
      if (state.markedFiles) state.markedFiles.delete(origName);
      if (state.markedBoxedHandles) state.markedBoxedHandles.delete(origName);
      if (state.markedDefectTags) state.markedDefectTags.delete(origName);
      if (state.markedCounts) state.markedCounts.delete(origName);
      if (state.criticalFiles) state.criticalFiles.delete(origName);
      setReview(origName,{status:"pending",decision:"auto"});


      // 3. 清理该照片的元数据（红框、追加缺陷标签、保存标记）
      var m = getMeta(origName);
      m.saved = false;
      m.boxes = [];
      m.appended = [];
      m.history = [];
      m.isSecondaryEdit = false;
      m.desktopBakedCount50 = 0;

      // 4. 清理图片缓存（防止继续展示已烘焙红框的圈示图）
      dropImage(origName);

      // 5. 如果当前正在浏览这张照片，立即重新加载未绘制红框的纯净原始大图
      if (idx === state.index && idx >= 0) {
        var cleanC = await getImage(idx);
        state.natural = { w: cleanC.img.naturalWidth, h: cleanC.img.naturalHeight };
        var fit = computeFit(cleanC.img.naturalWidth, cleanC.img.naturalHeight);
        fitView(fit.w, fit.h, fit.s);
        render();
        renderSide();
        updateHud();
      }

      // 6. 全量重新扫描输出目录并精准刷新左侧树与统计数据
      await scanOutputDirectory();

      toast('✓ 已取消标记，已移入成果回收站：' + deletedCount + ' 个缺陷文件');
    } catch (err) {
      toast('取消标记失败：' + (err && err.message || err));
    } finally {
      loadingEl.style.display = 'none';
    }
  }

  /* ---- 全局与杆塔/线路精确统计瞬时刷新（耗时 < 2ms，不重建 DOM，不扰动滚动条） ---- */

  // refreshTreeStats: i38 performance implementation below.


  /* ---- 左侧全量按线路/支线前缀分类、子文件夹杆塔统计、输出标记筛选与展开/折叠 ---- */

  function renderPathTreeContent(center){VirtualTree48.invalidate();VirtualTree48.rebuild(center);}
  // updatePathTreeSelection: i38 performance implementation below.


  function setFilterMode(mode) {
    filterMode = mode;
    btnFilterAll.classList.toggle('active', mode === 'all');
    btnFilterMarked.classList.toggle('active', mode === 'marked');
    btnFilterUnmarked.classList.toggle('active', mode === 'unmarked');
    btnFilterUnviewed.classList.toggle('active', mode === 'unviewed');

    if (mode === 'marked' && !output.mainHandle) {
      toast('提示：尚未连接输出目录，请先选择保存输出文件夹');
      selectOutputDir();
      return;
    }

    renderPathTree(true);

    if (state.files && state.files.length > 0) {
      if (!isFileMatchingFilter(state.index)) {
        var firstMatch = getNextFilteredIndex(-1, 1);
        if (firstMatch >= 0) {
          switchTo(firstMatch);
        } else {
          updateHud();
        }
      } else {
        updateHud();
      }
    }
  }

  btnFilterAll.addEventListener('click', function () { setFilterMode('all'); });
  btnFilterMarked.addEventListener('click', function () { setFilterMode('marked'); });
  btnFilterUnmarked.addEventListener('click', function () { setFilterMode('unmarked'); });
  btnFilterUnviewed.addEventListener('click', function () { setFilterMode('unviewed'); });

  function toggleGroupCollapseContent(prefix){if(!collapsedGroups.delete(prefix))collapsedGroups.add(prefix);VirtualTree48.rebuild(false);}
  function expandAllGroupsContent(){VirtualTree48.expandAll();}
  function collapseAllGroupsContent(){VirtualTree48.collapseAll();}

  /* ================= 文件夹重命名功能（双击重命名，支持磁盘与界面同步更新） ================= */

  // copyAndRemoveDirectoryContents: implementation in i35 reliability section.


  // renameDirectoryOnDisk: implementation in i35 reliability section.


  async function performRenameLineFolderImpl(oldLineName, newLineName) {
    if (oldLineName === newLineName) return;

    var diskPathKey = oldLineName + '/';
    var dirInfo = dirRegistry.get(diskPathKey);
    var diskResult = { success: false };

    if (dirInfo && dirInfo.parentHandle) {
      diskResult = await renameDirectoryOnDisk(dirInfo, oldLineName, newLineName);
    } else if (savedInputName === oldLineName || (lastInputHandle && lastInputHandle.name === oldLineName)) {
      savedInputName = newLineName;
      try { localStorage.setItem(KEY_INPUT_NAME, newLineName); } catch (e) {}
      diskResult = { success: true, method: 'root_display_only' };
    }

    if (!diskResult.success) { toast('文件夹重命名失败，保留原目录'); return; }
    // 同步更新所有文件的 relPath
    for (var i = 0; i < state.files.length; i++) {
      var f = state.files[i];
      var rel = f.relPath || f.name;
      if (rel.startsWith(oldLineName + '/')) {
        f.relPath = newLineName + '/' + rel.slice(oldLineName.length + 1);
      }
    }

    // 同步更新 dirRegistry 键名
    var newDirRegistry = new Map();
    dirRegistry.forEach(function (val, key) {
      if (key.startsWith(oldLineName + '/')) {
        var newKey = newLineName + '/' + key.slice(oldLineName.length + 1);
        if (key === oldLineName + '/') {
          val.name = newLineName;
          if (diskResult.newHandle) val.handle = diskResult.newHandle;
        }
        newDirRegistry.set(newKey, val);
      } else {
        newDirRegistry.set(key, val);
      }
    });
    dirRegistry = newDirRegistry;

    // 同步更新折叠集合
    if (collapsedGroups.has(oldLineName)) {
      collapsedGroups.delete(oldLineName);
      collapsedGroups.add(newLineName);
    }

    updateFolderButtonText();
    renderPathTree(true);

    await persistPhotoPaths();
    if (diskResult.method !== 'root_display_only') await refreshInputHandles();
    if (diskResult.success) {
      if (diskResult.method === 'root_display_only') {
        toast('✓ 已更新线路显示名称为: ' + newLineName + '（根文件夹请在系统资源管理器修改）');
      } else {
        toast('✓ 线路文件夹已成功重命名为: ' + newLineName);
      }
    } else {
      toast('✓ 线路已重命名为: ' + newLineName + '（磁盘权限受限未修改本地目录）');
    }
  }

  async function performRenameTowerFolderImpl(lineName, oldTowerName, newTowerName) {
    if (oldTowerName === newTowerName) return;

    var sampleOldDir = '';
    for (var i = 0; i < state.files.length; i++) {
      var f = state.files[i];
      var info = parseFilePrefixAndLocation(f.name, f.relPath);
      if (info.prefix === lineName && info.tower === oldTowerName) {
        sampleOldDir = dirOf(f.relPath || f.name);
        break;
      }
    }

    var diskResult = { success: false };
    var oldDirPathKey = sampleOldDir ? (sampleOldDir + '/') : '';
    var parentDir = sampleOldDir ? dirOf(sampleOldDir) : '';
    var newDirPathKey = (parentDir ? (parentDir + '/') : '') + newTowerName + '/';

    if (oldDirPathKey && dirRegistry.has(oldDirPathKey)) {
      var dirInfo = dirRegistry.get(oldDirPathKey);
      diskResult = await renameDirectoryOnDisk(dirInfo, oldTowerName, newTowerName);
    }

    if (!diskResult.success) { toast('文件夹重命名失败，保留原目录'); return; }
    for (var i = 0; i < state.files.length; i++) {
      var f = state.files[i];
      var info = parseFilePrefixAndLocation(f.name, f.relPath);
      if (info.prefix === lineName && info.tower === oldTowerName) {
        var fDir = dirOf(f.relPath || f.name);
        var fParent = dirOf(fDir);
        f.relPath = (fParent ? (fParent + '/') : '') + newTowerName + '/' + f.name;
      }
    }

    if (oldDirPathKey && dirRegistry.has(oldDirPathKey)) {
      var dirInfo = dirRegistry.get(oldDirPathKey);
      dirRegistry.delete(oldDirPathKey);
      dirInfo.name = newTowerName;
      if (diskResult.newHandle) dirInfo.handle = diskResult.newHandle;
      dirRegistry.set(newDirPathKey, dirInfo);
    }

    var oldTKey = lineName + ':::' + oldTowerName;
    var newTKey = lineName + ':::' + newTowerName;
    if (collapsedTowers.has(oldTKey)) {
      collapsedTowers.delete(oldTKey);
      collapsedTowers.add(newTKey);
    }

    renderPathTree(true);

    await persistPhotoPaths();
    if (diskResult.method !== 'root_display_only') await refreshInputHandles();
    if (diskResult.success) {
      toast('✓ 杆塔文件夹已成功重命名为: ' + newTowerName);
    } else {
      toast('✓ 杆塔已重命名为: ' + newTowerName);
    }
  }

  function startRenameFolder(nameEl) {
    if(ioBusy||saveQueueBusy48())return;
    if (!nameEl) return;
    if (document.querySelector('.rename-folder-input')) return;

    var folderType = nameEl.dataset.folderType; // 'line' | 'tower'
    var currentName = (folderType === 'line') ? nameEl.dataset.lineName : nameEl.dataset.towerName;
    if (!currentName) return;

    var prefix = nameEl.dataset.prefix || '';

    // 创建内联编辑输入框
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'rename-folder-input';
    input.value = currentName;
    input.dataset.oldName = currentName;
    input.dataset.folderType = folderType;
    input.dataset.prefix = prefix;
    input.title = '回车保存，Esc取消';

    input.addEventListener('click', function (ev) { ev.stopPropagation(); });
    input.addEventListener('dblclick', function (ev) { ev.stopPropagation(); });

    var committed = false;

    async function commitRename() {
      if (committed) return;
      committed = true;
      var newName = input.value.trim().replace(/^【|】$/g, '').trim();
      input.remove();
      nameEl.style.display = '';

      if (!newName || newName === currentName) return;

      var invalidPattern = new RegExp('[/\\\\:*?\"<>|]');
      if (invalidPattern.test(newName)) {
        toast('文件夹名称不能包含下列字符: \\ / : * ? " < > |');
        return;
      }

      if (folderType === 'line') {
        await performRenameLineFolder(currentName, newName);
      } else if (folderType === 'tower') {
        await performRenameTowerFolder(prefix, currentName, newName);
      }
    }

    function cancelRename() {
      if (committed) return;
      committed = true;
      input.remove();
      nameEl.style.display = '';
    }

    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        commitRename();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        cancelRename();
      }
    });

    input.addEventListener('blur', function () {
      commitRename();
    });

    nameEl.style.display = 'none';
    nameEl.parentNode.insertBefore(input, nameEl.nextSibling);
    input.focus();
    input.select();
  }

  /* ================= 杆塔对应图片重命名功能（双击名字即可编辑） ================= */

  function computeNewFileName(oldFileName, oldLoc, newLocInput) {
    var ext = oldFileName.slice(oldFileName.lastIndexOf('.'));
    var base = oldFileName.slice(0, oldFileName.lastIndexOf('.'));

    var cleanInput = (newLocInput || '').trim();
    // 若用户输入时带了扩展名，自动去除以防生成 .jpg.jpg
    if (cleanInput.toLowerCase().endsWith(ext.toLowerCase())) {
      cleanInput = cleanInput.slice(0, -ext.length).trim();
    }
    if (!cleanInput) return oldFileName;

    var cleanOldLoc = (oldLoc || '').trim();

    // 如果用户直接输入了包含双下划线的完整命名格式，或者输入内容已包含完整的前缀路径，直接使用
    if (cleanInput.indexOf('__') >= 0 || (base.indexOf('_') >= 0 && cleanInput.startsWith(base.slice(0, base.indexOf('_') + 1)))) {
      return cleanInput + ext;
    }

    // 1. 精确替换：仅修改文件名中对应的组件（部件）部分，绝不覆盖线路与杆塔等前缀信息
    if (cleanOldLoc && base.includes(cleanOldLoc)) {
      var lastIdx = base.lastIndexOf(cleanOldLoc);
      var newBase = base.slice(0, lastIdx) + cleanInput + base.slice(lastIdx + cleanOldLoc.length);
      return newBase + ext;
    }

    // 2. 若原文件名包含双下划线 __ （例如 线路__杆塔__部件 或 线路__部件）
    if (base.indexOf('__') >= 0) {
      var lastDblIdx = base.lastIndexOf('__');
      var prefixPart = base.slice(0, lastDblIdx + 2);
      return prefixPart + cleanInput + ext;
    }

    // 3. 若原文件名包含单下划线 _ 分隔（例如 线路_杆塔_部件）
    if (base.indexOf('_') >= 0) {
      var lastUnderIdx = base.lastIndexOf('_');
      var prefixPartSingle = base.slice(0, lastUnderIdx + 1);
      return prefixPartSingle + cleanInput + ext;
    }

    // 4. 原名本身就是纯组件名（如 DJI_001.JPG 或 变压器.jpg）
    return cleanInput + ext;
  }

  async function performRenamePhotoImpl(index, newLocInput, oldLoc) {
    if (index < 0 || index >= state.files.length) return;
    var f = state.files[index];
    var oldName = f.name;

    if (!oldLoc) {
      var info = parseFilePrefixAndLocation(oldName, f.relPath);
      oldLoc = info ? info.loc : '';
    }

    var newFileName = computeNewFileName(oldName, oldLoc, newLocInput);
    if (newFileName === oldName) return;

    // 校验非法字符
    var invalidPattern = new RegExp('[/\\\\:*?\"<>|]');
    if (invalidPattern.test(newFileName)) {
      toast('图片名称不能包含下列字符: \\ / : * ? " < > |');
      return;
    }

    // 检查当前同级目录内是否已存在重名文件
    var oldDir = dirOf(f.relPath || f.name);
    var hasDuplicate = state.files.some(function (other, oi) {
      if (oi === index) return false;
      var otherDir = dirOf(other.relPath || other.name);
      return (otherDir === oldDir && other.name.toLowerCase() === newFileName.toLowerCase());
    });
    if (hasDuplicate) {
      toast('该杆塔目录下已存在同名图片【' + newFileName + '】，请换一个名称');
      return;
    }

    // 1. 尝试在物理磁盘上重命名文件
    var diskRenamed = false;
    try {
      if (f.handle && typeof f.handle.move === 'function') {
        await f.handle.move(newFileName);
        diskRenamed = true;
      }
    } catch (err) {
      console.warn('f.handle.move() 异常，尝试目录写入备用方案:', err);
    }

    if (!diskRenamed && f.handle) {
      try {
        var dirPathKey = oldDir ? (oldDir + '/') : '';
        var dirInfo = dirRegistry ? dirRegistry.get(dirPathKey) : null;
        var dirHandle = dirInfo ? dirInfo.handle : lastInputHandle;
        if (dirHandle) {
          var srcFile = await f.handle.getFile();
          var collision = false;
          try { await dirHandle.getFileHandle(newFileName); collision = true; } catch (e) { if (e.name !== 'NotFoundError') throw e; }
          if (collision) throw new Error('目标文件已存在');
          var newFileHandle = await dirHandle.getFileHandle(newFileName, { create: true });
          var writable = await newFileHandle.createWritable();
          await writable.write(srcFile);
          await writable.close();
          if ((await newFileHandle.getFile()).size !== srcFile.size) throw new Error('重命名写入校验失败');
          await dirHandle.removeEntry(oldName);
          f.handle = newFileHandle;
          diskRenamed = true;
        }
      } catch (err) {
        console.error('物理磁盘重命名图片彻底失败:', err);
      }
    }

    if (!diskRenamed && f.handle) { toast('重命名失败，保留原名称'); return; }
    // 2. 更新内存数据结构
    f.name = newFileName;
    var parentDir = dirOf(f.relPath || '');
    f.relPath = (parentDir ? (parentDir + '/') : '') + newFileName;
    f.mime = mimeOf(newFileName);

    await persistPhotoPaths();
    saveViewedPhotos(true);

    // 3. 刷新视图
    renderPathTree(false);

    if (state.index === index) {
      renderSide();
      updateHud();
      if (typeof updateCurrentFileInfoDisplay === 'function') {
        updateCurrentFileInfoDisplay();
      }
    }

    if (diskRenamed) {
      toast('✓ 图片已成功重命名为: ' + newFileName);
    } else {
      toast('✓ 界面已更新为: ' + newFileName + '（磁盘权限受限未物理重命名）');
    }
  }

  function startRenamePhoto(photoNameEl) {
    if(ioBusy||saveQueueBusy48())return;
    if (!photoNameEl) return;
    if (document.querySelector('.rename-photo-input') || document.querySelector('.rename-folder-input')) return;

    var idx = parseInt(photoNameEl.dataset.idx, 10);
    if (isNaN(idx) || idx < 0 || idx >= state.files.length) return;

    var currentLoc = photoNameEl.dataset.loc || '';
    if (!currentLoc) {
      var f = state.files[idx];
      currentLoc = f ? f.name.replace(/\.[^.]+$/, '') : '';
    }

    if (state.index !== idx) { switchTo(idx); return; }

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'rename-photo-input';
    input.value = currentLoc;
    input.dataset.oldLoc = currentLoc;
    input.dataset.idx = idx;
    input.title = '回车保存，Esc取消';

    input.addEventListener('click', function (ev) { ev.stopPropagation(); });
    input.addEventListener('dblclick', function (ev) { ev.stopPropagation(); });

    var committed = false;

    async function commitRename() {
      if (committed) return;
      committed = true;
      var newLoc = input.value.trim();
      input.remove();
      photoNameEl.style.display = '';

      if (!newLoc || newLoc === currentLoc) return;

      var invalidPattern = new RegExp('[/\\\\:*?\"<>|]');
      if (invalidPattern.test(newLoc)) {
        toast('图片名称不能包含下列字符: \\ / : * ? " < > |');
        return;
      }

      await performRenamePhoto(idx, newLoc, currentLoc);
    }

    function cancelRename() {
      if (committed) return;
      committed = true;
      input.remove();
      photoNameEl.style.display = '';
    }

    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        commitRename();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        cancelRename();
      }
    });

    input.addEventListener('blur', function () {
      commitRename();
    });

    photoNameEl.style.display = 'none';
    photoNameEl.parentNode.insertBefore(input, photoNameEl.nextSibling);
    input.focus();
    input.select();
  }

  var photoClickTimer = null,lastPhotoClick48={id:null,time:0};

  pathTree.addEventListener('click', function (e) {
    if (e.target.closest('.rename-folder-input') || e.target.closest('.rename-photo-input')) return;
    var delBtn = e.target.closest('.btn-cancel-marked-mini');
    if (delBtn) {
      e.stopPropagation();
      e.preventDefault();
      if (photoClickTimer) {
        clearTimeout(photoClickTimer);
        photoClickTimer = null;
      }
      var rawName = delBtn.dataset.rawName;
      var delIdx = parseInt(delBtn.dataset.idx, 10);
      cancelMarkedDefect(delIdx);
      return;
    }
    if (e.target.closest('.folder-name-text')) {
      // 单击文件夹名字文本不触发折叠/展开，为双击重命名提供更平滑的操作体验
      return;
    }
    var locItem = e.target.closest('.loc-item');
    if (locItem && locItem.dataset.idx !== undefined) {
      var idx = parseInt(locItem.dataset.idx, 10);
      if (isNaN(idx)) return;

      var now=performance.now(),id=state.files[idx].id,second=e.detail>1||(lastPhotoClick48.id===id&&now-lastPhotoClick48.time<330);
      lastPhotoClick48={id:id,time:now};
      if(second&&e.target.closest('.photo-name-text')){lastPhotoClick48.id=null;startRenamePhoto(e.target.closest('.photo-name-text'));return;}
      switchTo(idx);
      return;
    }
    var towerHeader = e.target.closest('.tower-header');
    if (towerHeader && towerHeader.dataset.towerKey) {
      var tKey = towerHeader.dataset.towerKey;
      if (collapsedTowers.has(tKey)) {
        collapsedTowers.delete(tKey);
      } else {
        collapsedTowers.add(tKey);
      }
      var tGroup = towerHeader.closest('.tower-group');
      VirtualTree48.rebuild(false);
      return;
    }
    var pfxHeader = e.target.closest('.prefix-header');
    if (pfxHeader && pfxHeader.dataset.prefix) {
      toggleGroupCollapse(pfxHeader.dataset.prefix);
      return;
    }
  });

  pathTree.addEventListener('contextmenu', function (e) {
    var locItem = e.target.closest('.loc-item');
    if (locItem && locItem.dataset.idx !== undefined) {
      var idx = parseInt(locItem.dataset.idx, 10);
      if (state.files && state.files[idx]) {
        var fName = state.files[idx].id;
        if (state.markedFiles && state.markedFiles.has(fName)) {
          e.preventDefault();
          cancelMarkedDefect(fName);
        }
      }
    }
  });

  pathTree.addEventListener('dblclick', function (e) {
    if (photoClickTimer) {
      clearTimeout(photoClickTimer);
      photoClickTimer = null;
    }
    var photoEl = e.target.closest('.photo-name-text') || e.target.closest('.loc-name') || e.target.closest('.loc-item');
    if (photoEl) {
      e.preventDefault();
      e.stopPropagation();
      window.getSelection && window.getSelection().removeAllRanges();
      var targetSpan = photoEl.classList.contains('photo-name-text') ? photoEl : (photoEl.querySelector('.photo-name-text') || photoEl);
      if (targetSpan) {
        startRenamePhoto(targetSpan);
      }
      return;
    }
    var nameEl = e.target.closest('.folder-name-text');
    if (nameEl) {
      e.preventDefault();
      e.stopPropagation();
      window.getSelection && window.getSelection().removeAllRanges();
      startRenameFolder(nameEl);
      return;
    }
  });

  btnExpandAll.addEventListener('click', expandAllGroups);
  btnCollapseAll.addEventListener('click', collapseAllGroups);
  btnAutoFit.addEventListener('click', function () {
    autoFitLeftPanelWidth();
    toast('左侧栏已重新自适应宽度');
  });

  function scrollToLastViewedPhoto() {
    if (!state.files || state.files.length === 0) {
      toast('尚未加载照片');
      return;
    }

    var targetIdx=FastIndex.last();

    if (targetIdx < 0) {
      toast('暂无已看记录，定位到第 1 张照片');
      targetIdx = 0;
    }

    var f = state.files[targetIdx];
    if (!f) return;

    // 1. 若当前筛选模式过滤掉了该目标照片，切换回全部以保证可见
    if (filterMode === 'unviewed') {
      setFilterMode('all');
    }

    // 2. 确保目标照片所在的线路和杆塔处于展开状态
    var parsed = parseFilePrefixAndLocation(f.name, f.relPath);
    if (parsed) {
      if (parsed.prefix) collapsedGroups.delete(parsed.prefix);
      var twrKey = parsed.prefix + ':::' + parsed.tower;
      if (twrKey) collapsedTowers.delete(twrKey);
    }

    // 3. 立即切换加载并展示该照片，随后在左侧平滑居中滚动并触发呼吸高亮
    switchTo(targetIdx).then(function () {
      var curEl = pathTree.querySelector('.loc-item[data-idx="' + targetIdx + '"]');
      if (curEl) {
        Motion.scroll(curEl, true);
        curEl.classList.remove('highlight-flash');
        void curEl.offsetWidth; // 触发 reflow 重启关键帧动画
        curEl.classList.add('highlight-flash');
        setTimeout(function () { curEl.classList.remove('highlight-flash'); }, 1500);
      }
    });

    toast('已直达最后一个已看照片：' + (parsed ? (parsed.tower + ' · ' + parsed.loc) : f.name) + ' (第 ' + (targetIdx + 1) + ' / ' + state.files.length + ' 张)');
  }

  if (btnBackToCurrent) {
    btnBackToCurrent.addEventListener('click', scrollToLastViewedPhoto);
  }

  // switchTo: implementation in i35 reliability section.


  /* ================= 候选分类池（可增删改）核心方法 ================= */

  function getDefaultCandidatePool() {
    var set = new Set();
    for (var i = 0; i < KNOWN_POSITIONS.length; i++) set.add(KNOWN_POSITIONS[i]);
    for (var c in DEFAULT_DEFECT_DICT) set.add(c);
    for (var p in DEFAULT_LOCATION_ADJACENCY) set.add(p);
    return Array.from(set).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
  }

  function saveCandidatePool() {
    try { localStorage.setItem(KEY_CANDIDATE_POOL, JSON.stringify(candidatePool)); return true; }
    catch (e) { toast('词池保存失败，操作未完成：' + (e.message || e), 6000); return false; }
  }

  function loadCandidatePool() {
    function words(arr) { return Array.from(new Set(arr.filter(function(x) {return typeof x === 'string';}).map(function(x) {return x.trim();}).filter(Boolean))); }
    try {
      var raw = localStorage.getItem(KEY_CANDIDATE_POOL);
      if (raw !== null) {
        var saved = JSON.parse(raw);
        if (Array.isArray(saved)) { candidatePool = words(saved); return; }
      }
      // One-time migration retains the former visible list. Subsequent loads have one source of truth.
      var legacyRaw = localStorage.getItem(LEGACY_KEY_CANDIDATE_POOL);
      var legacy = legacyRaw === null ? null : JSON.parse(legacyRaw);
      if (Array.isArray(legacy) && legacy.length === 0) candidatePool = [];
      else candidatePool = words((Array.isArray(legacy) ? legacy : getDefaultCandidatePool())
        .concat(Object.keys(defectDict), Object.keys(locationAdjacency)));
      candidatePool.sort(function(a,b) {return a.localeCompare(b, 'zh-CN');});
      saveCandidatePool();
    } catch (e) {
      candidatePool = getDefaultCandidatePool();
      toast('词池数据读取异常，暂显示默认词项；原存储未被覆盖', 6000);
    }
  }

  function getAllKnownCategories() {
    // The managed candidate pool is independent of category/rule definitions.
    return Array.from(new Set(candidatePool)).sort(function(a,b) {return a.localeCompare(b, 'zh-CN');});
  }

  function addCandidatePoolItem(items) {
    if (!Array.isArray(items)) items = [items];
    var added = 0;
    for (var i = 0; i < items.length; i++) {
      var it = (items[i] || '').trim();
      if (!it) continue;
      if (candidatePool.indexOf(it) < 0) {
        candidatePool.push(it);
        added++;
      }
    }
    if (added > 0) {
      candidatePool.sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
      saveCandidatePool();
    }
    return added;
  }

  function removeCandidatePoolItem(item) {
    if (candidatePool.indexOf(item) < 0) return false;
    var before = candidatePool;
    candidatePool = candidatePool.filter(function(x) {return x !== item;});
    if (!saveCandidatePool()) { candidatePool = before; return false; }
    return true;
  }

  function renameCandidatePoolItem(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return false;
    var idx = candidatePool.indexOf(oldName);
    if (idx >= 0) {
      candidatePool[idx] = newName;
      candidatePool.sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
      saveCandidatePool();

      // 联动重命名推荐图谱
      if (locationAdjacency[oldName]) {
        locationAdjacency[newName] = locationAdjacency[oldName];
        delete locationAdjacency[oldName];
      }
      for (var k in locationAdjacency) {
        var arr = locationAdjacency[k];
        for (var i = 0; i < arr.length; i++) {
          if (arr[i] === oldName) arr[i] = newName;
        }
      }
      saveAdjacency();

      // 联动重命名缺陷分类
      if (defectDict[oldName]) {
        defectDict[newName] = defectDict[oldName];
        delete defectDict[oldName];
        saveDefectDict();
      }

      return true;
    }
    return false;
  }

  /* ================= 规则操作底层方法 ================= */

  function addRecommendationRule(sourceCat, targetItems, isBilateral) {
    if (!sourceCat) return 0;
    if (!Array.isArray(targetItems)) targetItems = [targetItems];
    if (!locationAdjacency[sourceCat]) locationAdjacency[sourceCat] = [];

    var addedCount = 0;
    for (var i = 0; i < targetItems.length; i++) {
      var item = (targetItems[i] || '').trim();
      if (!item || item === sourceCat) continue;
      if (locationAdjacency[sourceCat].indexOf(item) < 0) {
        locationAdjacency[sourceCat].push(item);
        addedCount++;
      }
      addCandidatePoolItem(item); // 自动补齐候选池
      if (isBilateral) {
        if (!locationAdjacency[item]) locationAdjacency[item] = [];
        if (locationAdjacency[item].indexOf(sourceCat) < 0) {
          locationAdjacency[item].push(sourceCat);
        }
      }
    }
    if (addedCount > 0) saveAdjacency();
    return addedCount;
  }

  function removeRecommendationRule(sourceCat, targetItem) {
    if (!sourceCat || !locationAdjacency[sourceCat]) return false;
    var idx = locationAdjacency[sourceCat].indexOf(targetItem);
    if (idx >= 0) {
      locationAdjacency[sourceCat].splice(idx, 1);
      saveAdjacency();
      return true;
    }
    return false;
  }

  function clearCategoryRecommendations(sourceCat) {
    if (locationAdjacency[sourceCat]) {
      locationAdjacency[sourceCat] = [];
      saveAdjacency();
      return true;
    }
    return false;
  }

  /* ================= 右侧面板：保持简洁纯粹的缺陷分类与命名标签 ================= */

  function newNamePreview(photoId48) {
    var name = photoId48 || curName();
    if (!name) return { base: '', ext: '', appended: [], full: '' };
    var m = getMeta(name);
    var visibleName = displayName(name);
    var ext = visibleName.slice(visibleName.lastIndexOf('.'));
    var base = visibleName.slice(0, visibleName.lastIndexOf('.'));

    var appended = m.appended || [];
    if (appended.length === 0 && !m.isSecondaryEdit && !m.tagsCleared) {
      var savedTag = getDefectTagsForFile(name);
      if (savedTag && !base.endsWith(savedTag)) {
        var tags = savedTag.split(/(?=_)/).filter(Boolean);
        if (tags.length > 0) {
          m.appended = tags.slice();
          if (!m.boxes.length) m.saved = true;
          appended = m.appended;
        }
      }
    }
    return { base: base, ext: ext, appended: appended, full: base + appended.join('') + ext };
  }

  function updateTreeCurrentDefectTag(name, dTag) {
    if (!pathTree) return;
    var curEl = treeRows.get(state.indexByName.get(name));
    if (!curEl) return;
    var nameTextEl = curEl.querySelector('.photo-name-text');
    if (!nameTextEl) return;
    var defectSpan = nameTextEl.querySelector('.item-defect-tag');
    if (dTag) {
      if (!defectSpan) {
        defectSpan = document.createElement('span');
        defectSpan.className = 'item-defect-tag';
        defectSpan.style.cssText = 'color:var(--accent);font-weight:600';
        nameTextEl.appendChild(defectSpan);
      }
      defectSpan.textContent = dTag;
    } else {
      if (defectSpan) defectSpan.remove();
    }
  }

  function appendDefect(text) {
    if(editLocked48())return;
    var name = curName();
    if (!name) return;
    var t = String(text || '');
    if (t.charAt(0) !== '_') t = '_' + t;
    var m = getMeta(name);
    m.tagsCleared = false;
    if (m.appended.indexOf(t) >= 0) { toast('已追加过该缺陷'); return; }
    m.appended.push(t);
    m.saved = false;
    m.history.push({ type: 'name', tag: t });
    var allTags = m.appended.join('');
    if (state.markedDefectTags) {
      state.markedDefectTags.set(name, allTags);
    }
    renderSide();
    updateTreeCurrentDefectTag(name, allTags);
    updateHud();
    flashItem(t);
  }
  function flashItem(t) {
    var els = sideScroll.querySelectorAll('.def-item .t');
    for (var i = 0; i < els.length; i++) {
      if (els[i].textContent === t) {
        var el = els[i].closest('.def-item');
        el.classList.add('flash');
        setTimeout(function () { el.classList.remove('flash'); }, 350);
      }
    }
  }

  function saveDefectDict() {
    try { localStorage.setItem(KEY_DEFECT_DICT, JSON.stringify(defectDict)); } catch (e) {}
    sideDictVersion++;
  }
  function loadDefectDict() {
    try {
      var raw = localStorage.getItem(KEY_DEFECT_DICT);
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') defectDict = obj;
      }
    } catch (e) {}
  }

  function saveAdjacency() {
    try { localStorage.setItem(KEY_ADJACENCY, JSON.stringify(locationAdjacency)); } catch (e) {}
    sideDictVersion++;
  }
  function loadAdjacency() {
    try {
      var raw = localStorage.getItem(KEY_ADJACENCY);
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') locationAdjacency = obj;
      }
    } catch (e) {}
  }

  var saveViewedTimer=null,viewedDirty48=new Map(),viewedFlush48=null,viewedReady48=Promise.resolve(),viewedError48=null;
  function saveViewedPhotos(immediate){
    if(immediate){clearTimeout(saveViewedTimer);saveViewedTimer=null;return flushViewed48();}
    if(!saveViewedTimer)saveViewedTimer=setTimeout(function(){saveViewedTimer=null;flushViewed48();},240);
  }
  async function flushViewed48(){
    if(viewedFlush48)return viewedFlush48;
    if(!viewedDirty48.size)return true;
    var batch=Array.from(viewedDirty48);viewedDirty48.clear();
    viewedFlush48=(async function(){
      try{await viewedReady48;await recordBatch46('viewed:global',batch);viewedError48=null;return true;}
      catch(e){batch.forEach(function(r){if(!viewedDirty48.has(r[0]))viewedDirty48.set(r[0],r[1]);});viewedError48=e;toast('已看记录尚未保存，请在任务面板重试：'+e.message,6000);return false;}
      finally{viewedFlush48=null;if(typeof SaveQueue48!=='undefined')SaveQueue48.paint();}
    })();
    var ok=await viewedFlush48;if(ok&&viewedDirty48.size)saveViewedPhotos();return ok;
  }
  function loadViewedPhotos(){
    viewedReady48=migrateRecords46('viewed:global',KEY_VIEWED).then(function(rows){viewedPhotosMap=rows;FastIndex.invalidate();});
    viewedReady48.catch(function(e){viewedError48=e;toast('已看记录读取失败，请重新打开页面：'+e.message,7000);});
    return viewedReady48;
  }
  window.addEventListener('beforeunload',function(){if(!window.desktopAPI)saveViewedPhotos(true);});

  var lastRenderedSideLoc = null;
  var lastRenderedSideQ = null;
  var lastSideDictVersion = 0;
  var sideDictVersion = 1;

  function renderSide(force) {
    clearTimeout(sideTimer38);sideScroll.inert=false;
    var name = curName();
    if (!name) {
      if (previewEl) previewEl.innerHTML = '';
      sideScroll.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:24px 0">未打开图片</div>';
      lastRenderedSideLoc = null;
      return;
    }
    var loc = detectLocation(name);
    var pv = newNamePreview();

    var isAnyCritical = false;
    var tagsHtml = '';
    if (pv.appended.length > 0) {
      for (var ti = 0; ti < pv.appended.length; ti++) {
        var aTag = pv.appended[ti];
        var isCrit = isCriticalDefectTag(aTag);
        if (isCrit) isAnyCritical = true;
        tagsHtml += '<span class="preview-tag ' + (isCrit ? 'is-crit-tag' : '') + '" data-idx="' + ti + '" data-tag="' + esc(aTag) + '" title="点击直接撤回/移除此缺陷命名" ' + (isCrit ? 'style="border-color:rgba(220,38,38,0.5);color:#dc2626;background:rgba(220,38,38,0.08)"' : '') + '>' + esc(aTag) + '<span class="tag-del-x">✕</span></span>';
      }
    }

    isAnyCritical = effectiveCritical(name);
    var critBadgeHtml = isAnyCritical ? '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(220,38,38,0.15);color:#dc2626;font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:3px;border:1px solid rgba(220,38,38,0.35);margin-left:6px" title="依据本图人工判定或标签默认；主保存管理自动副本，独立保存的危急图片另行保留">⚠️ 本图判为危急（主保存另存副本）</span>' : '';

    var criticalSavedBadgeHtml = (state.criticalFiles && state.criticalFiles.has(name)) ? '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(31,122,60,0.15);color:var(--ok);font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:3px;border:1px solid rgba(31,122,60,0.35);margin-left:6px" title="已存在危急成果；自动副本与独立保存分别管理">✓ 已存危急缺陷</span>' : '';

    var disp = '<span class="preview-base" title="' + esc(pv.base) + '">' + esc(pv.base) + '</span>' + (tagsHtml || '') + '<span class="preview-ext">' + esc(pv.ext) + '</span>' + critBadgeHtml + criticalSavedBadgeHtml;
    if (previewEl) previewEl.innerHTML = disp;

    var q = (searchInput && searchInput.value || '').trim().toLowerCase();
    if (!force && loc === lastRenderedSideLoc && q === lastRenderedSideQ && sideDictVersion === lastSideDictVersion && sideScroll.children.length > 0) {
      return;
    }
    lastRenderedSideLoc = loc;
    lastRenderedSideQ = q;
    lastSideDictVersion = sideDictVersion;

    var relatedPositions = getRelatedPositions(loc);

    var exactCategoryName = null;
    for (var cat in defectDict) {
      if (cat === loc || (loc && (cat.indexOf(loc) >= 0 || loc.indexOf(cat) >= 0))) {
        exactCategoryName = cat;
        break;
      }
    }

    var renderedCategories = new Set();
    var categoryOrder = [];

    if (exactCategoryName && defectDict[exactCategoryName]) {
      categoryOrder.push({ name: exactCategoryName, type: 'matched' });
      renderedCategories.add(exactCategoryName);
    }

    for (var ri = 0; ri < relatedPositions.length; ri++) {
      var rCat = relatedPositions[ri];
      if (!renderedCategories.has(rCat) && defectDict[rCat]) {
        categoryOrder.push({ name: rCat, type: 'related' });
        renderedCategories.add(rCat);
      }
    }

    for (var cName in defectDict) {
      if (!renderedCategories.has(cName)) {
        categoryOrder.push({ name: cName, type: 'normal' });
        renderedCategories.add(cName);
      }
    }

    var html = '';
    // 缺陷分类区头部：直接集成「修改推荐规则」与「新建分类」
    html += '<div class="sec-title">';
    html += '  <span title="点击缺陷标签右侧的⚠按钮，可自行设置/取消危急缺陷属性">缺陷分类 <span style="font-size:10px;color:var(--muted);font-weight:400">（⚠ 可设置危急）</span></span>';
    html += '  <div style="display:flex;align-items:center;gap:4px">';
    html += '    <button id="btnSideConfigRec" class="mini-tool-btn" type="button" title="进入推荐规则与分类管理二级界面" style="color:var(--accent);font-weight:600;height:22px">修改推荐规则</button>';
    html += '    <button id="btnSideAddCat" class="mini-tool-btn" type="button" title="新建缺陷分类" style="height:22px">新建分类</button>';
    html += '  </div>';
    html += '</div>';

    var visibleCount = 0;
    for (var i = 0; i < categoryOrder.length; i++) {
      var item = categoryOrder[i];
      var catKey = item.name;
      var cItems = (defectDict[catKey] || []).filter(function (t) {
        return !isHidden(t) && (!q || t.toLowerCase().indexOf(q) >= 0 || catKey.toLowerCase().indexOf(q) >= 0);
      });

      if (q && cItems.length === 0 && catKey.toLowerCase().indexOf(q) < 0) continue;

      var styleClass = item.type === 'matched' ? 'matched' : (item.type === 'related' ? 'related' : '');
      var badgeHtml = item.type === 'matched' ? '<span class="badge boxed" style="font-size:10px;padding:1px 4px">当前匹配</span>' :
                      (item.type === 'related' ? '<span class="badge unboxed" style="font-size:10px;padding:1px 4px">关联推荐</span>' : '');

      html += renderCategoryGroup(catKey, cItems, styleClass, badgeHtml);
      visibleCount++;
    }

    if (visibleCount === 0 && q) {
      html += '<div style="color:var(--muted);font-size:12px;text-align:center;padding:24px 0">未找到包含「' + esc(q) + '」的缺陷标签</div>';
    }

    var hc = Object.keys(hiddenDefects).length;
    if (hc > 0) html += '<div class="hidden-info"><span>已隐藏 ' + hc + ' 项</span><button id="restoreHidden" class="btn" type="button">恢复</button></div>';

    sideScroll.innerHTML = html;
    Motion.panel(sideScroll);
  }

  // 保持右侧标签绝对简洁清爽，无占位拖拽手柄，支持直接按住拖拽排序与移动，使用极简高清晰矢量图标
  function renderCategoryGroup(catName, items, extraClass, badgeHtml) {
    var h = '<div class="pos-group ' + (extraClass || '') + '" data-category="' + esc(catName) + '">';
    h += '  <div class="pos-header" draggable="true" data-category="' + esc(catName) + '" title="按住可上下拖动调整分类位置">';
    h += '    <span class="pos-title-text" title="分类：' + esc(catName) + '">【' + esc(catName) + '】 ' + (badgeHtml || '') + '</span>';
    h += '    <span class="pos-count" title="该分类下标签数量">' + (items ? items.length : 0) + '</span>';
    h += '    <div class="pos-actions">';
    h += '      <button class="action-icon-btn config-rel-btn" data-category="' + esc(catName) + '" title="配置关联推荐">' + ICONS.link + '</button>';
    h += '      <button class="action-icon-btn edit-cat-btn" data-category="' + esc(catName) + '" title="重命名此分类">' + ICONS.edit + '</button>';
    h += '      <button class="action-icon-btn add-to-cat-btn" data-category="' + esc(catName) + '" title="在此分类下添加新标签">' + ICONS.plus + '</button>';
    h += '      <button class="action-icon-btn del-btn del-cat-btn" data-category="' + esc(catName) + '" title="删除此分类">' + ICONS.trash + '</button>';
    h += '    </div>';
    h += '  </div>';
    h += '  <div class="pos-body" data-category="' + esc(catName) + '">';
    if (items && items.length > 0) {
      for (var i = 0; i < items.length; i++) {
        h += defItemHtml(items[i], catName);
      }
    } else {
      h += '<div style="font-size:11px;color:var(--muted);padding:4px 6px">暂无标签，点击右上角 + 添加或将其他标签拖入</div>';
    }
    h += '  </div>';
    h += '</div>';
    return h;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }

  function defItemHtml(t, cat) {
    var isCrit = isCriticalDefectTag(t);
    var critBadge = isCrit ? '<span class="critical-indicator" title="用户已将此缺陷设为危急缺陷，保存时会额外输出至「危急缺陷」目录" style="display:inline-flex;align-items:center;justify-content:center;background:rgba(239,68,68,0.14);color:#dc2626;font-size:10px;font-weight:700;padding:1px 4px;border-radius:3px;margin-right:4px;border:1px solid rgba(239,68,68,0.35);flex-shrink:0">危急</span>' : '';
    var textStyle = isCrit ? 'color:#dc2626;font-weight:600' : '';
    var criticalBtn = '<button class="action-icon-btn critical-toggle-btn ' + (isCrit ? 'active' : '') + '" title="' + (isCrit ? '取消【' + esc(t) + '】的危急缺陷属性' : '将【' + esc(t) + '】设为危急缺陷') + '" data-category="' + esc(cat) + '" data-text="' + esc(t) + '" aria-label="' + (isCrit ? '取消危急缺陷' : '设为危急缺陷') + '">' + (isCrit ? '✓' : '⚠') + '</button>';
    return '<div class="def-item ' + (isCrit ? 'is-critical-item' : '') + '" draggable="true" data-category="' + esc(cat) + '" data-text="' + esc(t) + '" title="' + (isCrit ? '【危急缺陷】' : '') + '点击应用此标签；按住可拖动排序或移动">' +
      critBadge +
      '<span class="t" style="' + textStyle + '">' + esc(t) + '</span>' +
      '<div class="item-actions">' +
      criticalBtn +
      '  <button class="action-icon-btn edit-tag-btn" title="编辑修改此标签" data-category="' + esc(cat) + '" data-text="' + esc(t) + '">' + ICONS.edit + '</button>' +
      '  <button class="action-icon-btn del-btn del-tag-btn" title="删除/隐藏此标签" data-category="' + esc(cat) + '" data-text="' + esc(t) + '">' + ICONS.close + '</button>' +
      '</div>' +
      '</div>';
  }

  /* ---- 隐藏/恢复缺陷 ---- */
  function isHidden(t) { return !!hiddenDefects[t]; }
  function saveHidden() {
    try { localStorage.setItem(KEY_HIDDEN, JSON.stringify(Object.keys(hiddenDefects))); } catch (e) {}
    sideDictVersion++;
  }
  function hideDefect(t) {
    hiddenDefects[t] = true;
    saveHidden();
    renderSide();
  }
  function restoreHidden() {
    hiddenDefects = {};
    saveHidden();
    renderSide();
  }
  function loadHidden() {
    try {
      var raw = localStorage.getItem(KEY_HIDDEN);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          var o = {};
          for (var i = 0; i < arr.length; i++) o[arr[i]] = true;
          hiddenDefects = o;
        }
      }
    } catch (e) {}
  }

  /* ================= 模板导出与导入（复用全套分类与推荐机制） ================= */

  function exportTemplateFile() {
    try {
      var catCount = Object.keys(defectDict).length;
      var recCount = Object.keys(locationAdjacency).length;
      var poolCount = candidatePool.length;
      var now = new Date();
      var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      var timeStr = now.toLocaleString('zh-CN');

      var template = {
        appName: '巡检缺陷命名分类工具',
        fileType: 'xunjian_defect_template',
        version: '2.2',
        exportTime: timeStr,
        description: '电力巡检缺陷分类标签、危急缺陷属性、推荐机制及候选词池配置文件',
        defectDict: defectDict,
        locationAdjacency: locationAdjacency,
        candidatePool: candidatePool,
        criticalDefects: Array.from(criticalDefects)
      };

      var jsonStr = JSON.stringify(template, null, 2);
      var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = '巡检缺陷标签与推荐规则模板_' + dateStr + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast('✓ 已导出模板文件（包含 ' + catCount + ' 个分类、' + recCount + ' 条推荐规则、' + poolCount + ' 个候选词）');
    } catch (err) {
      toast('导出模板失败：' + (err && err.message || err));
    }
  }

  function triggerImportTemplate() {
    templateFileInput.value = '';
    templateFileInput.click();
  }

  templateFileInput.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (evt) {
      try {
        var content = evt.target.result;
        var data = JSON.parse(content);
        if (!data || typeof data !== 'object') {
          toast('文件格式错误：非标准 JSON 模板文件');
          return;
        }
        if (!data.defectDict && !data.locationAdjacency) {
          toast('模板内容无效：未包含缺陷分类或推荐机制数据');
          return;
        }

        pendingImportData = {
          fileName: file.name,
          exportTime: data.exportTime || '未知',
          defectDict: data.defectDict || {},
          locationAdjacency: data.locationAdjacency || {},
          candidatePool: Array.isArray(data.candidatePool) ? data.candidatePool : null,
          criticalDefects: Array.isArray(data.criticalDefects) ? data.criticalDefects : null
        };

        var catNum = Object.keys(pendingImportData.defectDict).length;
        var recNum = Object.keys(pendingImportData.locationAdjacency).length;

        importFileName.textContent = file.name;
        importCategoryCount.textContent = catNum + ' 个';
        importAdjacencyCount.textContent = recNum + ' 条';
        importExportTime.textContent = pendingImportData.exportTime;

        importModal.classList.add('show');
      } catch (err) {
        toast('读取模板文件失败：' + (err && err.message || err));
      }
    };
    reader.readAsText(file, 'utf-8');
  });

  function closeImportModal() {
    importModal.classList.remove('show');
    pendingImportData = null;
  }

  btnCancelImport.addEventListener('click', closeImportModal);
  importModal.addEventListener('click', function (e) {
    if (e.target === importModal) closeImportModal();
  });

  btnDoOverwriteImport.addEventListener('click', function () {
    if (!pendingImportData) return;
    defectDict = JSON.parse(JSON.stringify(pendingImportData.defectDict));
    locationAdjacency = JSON.parse(JSON.stringify(pendingImportData.locationAdjacency));
    if (Array.isArray(pendingImportData.criticalDefects)) {
      criticalDefects = new Set(pendingImportData.criticalDefects.map(function (x) { return String(x).trim(); }).filter(Boolean));
    } else {
      criticalDefects = new Set();
      for (var impCat0 in defectDict) {
        var impItems0 = defectDict[impCat0] || [];
        for (var impIdx0 = 0; impIdx0 < impItems0.length; impIdx0++) {
          if (CRITICAL_DEFECT_SET.has(impItems0[impIdx0])) criticalDefects.add(impItems0[impIdx0]);
        }
      }
    }
    // 防止模板中残留已删除标签的危急属性，只保留当前缺陷列表中存在的标签。
    var importedTagSet = new Set();
    for (var impCat1 in defectDict) {
      var impItems1 = defectDict[impCat1] || [];
      for (var impIdx1 = 0; impIdx1 < impItems1.length; impIdx1++) importedTagSet.add(impItems1[impIdx1]);
    }
    criticalDefects = new Set(Array.from(criticalDefects).filter(function (x) { return importedTagSet.has(x); }));
    if (pendingImportData.candidatePool) {
      candidatePool = pendingImportData.candidatePool.slice();
      saveCandidatePool();
    }
    saveDefectDict();
    saveCriticalDefects();
    saveAdjacency();
    closeImportModal();
    renderSide();
    if (recommendModal.classList.contains('show')) {
      renderCurrentRecPosDetails();
      renderModalCategoryList();
    }
    toast('✓ 已成功按模板完全覆盖分类、推荐规则与候选词池！');
  });

  btnDoMergeImport.addEventListener('click', function () {
    if (!pendingImportData) return;
    var newCats = 0, newTags = 0, newRules = 0, newPool = 0;

    var impDict = pendingImportData.defectDict;
    var importedCriticalSet = Array.isArray(pendingImportData.criticalDefects) ? new Set(pendingImportData.criticalDefects.map(function (x) { return String(x).trim(); })) : null;
    for (var cat in impDict) {
      if (!defectDict[cat]) {
        defectDict[cat] = impDict[cat].slice();
        newCats++;
      } else {
        var existList = defectDict[cat];
        var toAddList = impDict[cat] || [];
        for (var i = 0; i < toAddList.length; i++) {
          if (existList.indexOf(toAddList[i]) < 0) {
            existList.push(toAddList[i]);
            newTags++;
          }
        }
      }
    }

    // 模板若包含危急属性，则同步导入这些标签的危急设置；未包含该字段的旧模板不改变现有设置。
    if (importedCriticalSet) {
      for (var impCat2 in impDict) {
        var impItems2 = impDict[impCat2] || [];
        for (var impIdx2 = 0; impIdx2 < impItems2.length; impIdx2++) {
          var impTag2 = impItems2[impIdx2];
          if (importedCriticalSet.has(impTag2)) criticalDefects.add(impTag2);
        }
      }
    }

    var impAdj = pendingImportData.locationAdjacency;
    for (var pos in impAdj) {
      if (!locationAdjacency[pos]) {
        locationAdjacency[pos] = impAdj[pos].slice();
        newRules++;
      } else {
        var existRecs = locationAdjacency[pos];
        var toAddRecs = impAdj[pos] || [];
        for (var j = 0; j < toAddRecs.length; j++) {
          if (existRecs.indexOf(toAddRecs[j]) < 0) {
            existRecs.push(toAddRecs[j]);
            newRules++;
          }
        }
      }
    }

    if (pendingImportData.candidatePool) {
      newPool = addCandidatePoolItem(pendingImportData.candidatePool);
    }

    saveDefectDict();
    saveCriticalDefects();
    saveAdjacency();
    closeImportModal();
    renderSide();
    if (recommendModal.classList.contains('show')) {
      renderCurrentRecPosDetails();
      renderModalCategoryList();
    }
    toast('✓ 智能合并完成：新增 ' + newCats + ' 个分类，补充 ' + newTags + ' 个标签与 ' + newRules + ' 条推荐规则！');
  });

  if (btnExportTemplate) btnExportTemplate.addEventListener('click', exportTemplateFile);
  if (btnImportTemplate) btnImportTemplate.addEventListener('click', triggerImportTemplate);
  if (btnExportTemplateSettings) btnExportTemplateSettings.addEventListener('click', function () { settingsPanel.classList.remove('show'); exportTemplateFile(); });
  if (btnImportTemplateSettings) btnImportTemplateSettings.addEventListener('click', function () { settingsPanel.classList.remove('show'); triggerImportTemplate(); });
  if (btnExportRecModal) btnExportRecModal.addEventListener('click', exportTemplateFile);
  if (btnImportRecModal) btnImportRecModal.addEventListener('click', triggerImportTemplate);

  /* ================= 二级配置界面（目标部件增删改、关联分类增删改、分类列表增删改、候选词池增删改） ================= */

  var curEditingRecPos = '';
  var activeModalTab = 'rec'; // 'rec' | 'cat'

  function setModalTab(tab) {
    activeModalTab = tab;
    tabModalRec.classList.toggle('active', tab === 'rec');
    tabModalCat.classList.toggle('active', tab === 'cat');
    modalViewRec.style.display = tab === 'rec' ? 'flex' : 'none';
    modalViewCat.style.display = tab === 'cat' ? 'flex' : 'none';
    if (tab === 'cat') renderModalCategoryList();
    Motion.panel(tab === 'rec' ? modalViewRec : modalViewCat);
  }

  tabModalRec.addEventListener('click', function () { setModalTab('rec'); });
  tabModalCat.addEventListener('click', function () { setModalTab('cat'); });

  function openRecommendModal(targetPos, preferredTab) {
    var allPositions = new Set();
    for (var p in locationAdjacency) allPositions.add(p);
    for (var c in defectDict) allPositions.add(c);
    for (var i = 0; i < candidatePool.length; i++) allPositions.add(candidatePool[i]);

    var posArr = Array.from(allPositions).sort(function (a, b) {
      return a.localeCompare(b, 'zh-CN');
    });

    var curSelected = targetPos || curEditingRecPos || (posArr.length > 0 ? posArr[0] : '');
    if (targetPos && posArr.indexOf(targetPos) < 0) {
      posArr.unshift(targetPos);
      curSelected = targetPos;
    }

    var posHtml = '';
    for (var j = 0; j < posArr.length; j++) {
      var pName = posArr[j];
      var hasRule = !!(locationAdjacency[pName] && locationAdjacency[pName].length > 0);
      var ruleText = hasRule ? ' (' + locationAdjacency[pName].length + '项推荐)' : '';
      posHtml += '<option value="' + esc(pName) + '"' + (pName === curSelected ? ' selected' : '') + '>' + esc(pName) + ruleText + '</option>';
    }
    recPosSelect.innerHTML = posHtml;

    curEditingRecPos = curSelected;
    renderCurrentRecPosDetails();
    setModalTab(preferredTab || 'rec');
    recommendModal.classList.add('show');
  }

  /* ---- 1. 目标部件与关联分类增删改 ---- */

  function renderCurrentRecPosDetails() {
    var pos = recPosSelect.value || curEditingRecPos;
    if (!pos) {
      recTagContainer.innerHTML = '<div style="color:var(--muted);font-size:11.5px;padding:8px">请选择或新建一个目标部件</div>';
      return;
    }
    curEditingRecPos = pos;

    var list = locationAdjacency[pos] || [];
    var html = '';
    if (list.length > 0) {
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        html += '<span class="rec-chip" data-item="' + esc(item) + '"><span>' + esc(item) + '</span><span class="edit-chip" data-item="' + esc(item) + '" title="修改此关联分类名称">' + ICONS.edit + '</span><span class="del-chip" data-item="' + esc(item) + '" title="移除此推荐">' + ICONS.close + '</span></span>';
      }
    } else {
      html += '<div style="color:var(--muted);font-size:12px;padding:8px">暂未配置相近关联推荐，可通过下方添加</div>';
    }
    recTagContainer.innerHTML = html;

    var allCats = getAllKnownCategories();
    var available = [];
    var candidateHtml = '';

    for (var m = 0; m < allCats.length; m++) {
      var candidate = allCats[m];
      if (candidate === pos && !isCandidateManageMode) continue;
      var isAdded = list.indexOf(candidate) >= 0;
      if (!isAdded) available.push(candidate);

      if (isCandidateManageMode) {
        candidateHtml += '<span class="candidate-pill managing" data-candidate="' + esc(candidate) + '">';
        candidateHtml += '  <span>' + esc(candidate) + '</span>';
        candidateHtml += '  <span class="pill-action edit" data-candidate="' + esc(candidate) + '" title="重命名此候选词">' + ICONS.edit + '</span>';
        candidateHtml += '  <span class="pill-action del" data-candidate="' + esc(candidate) + '" title="从候选词池移除，保留已有分类与规则">' + ICONS.close + '</span>';
        candidateHtml += '</span>';
      } else {
        candidateHtml += '<span class="candidate-pill' + (isAdded ? ' active' : '') + '" data-cat="' + esc(pos) + '" data-candidate="' + esc(candidate) + '" title="' + (isAdded ? '已关联（点击可直接移除）' : '点击直接关联推荐') + '">' + (isAdded ? '✓ ' : '+ ') + esc(candidate) + '</span>';
      }
    }

    var addOptHtml = '<option value="">-- 从已有选择 --</option>';
    for (var a = 0; a < available.length; a++) {
      addOptHtml += '<option value="' + esc(available[a]) + '">' + esc(available[a]) + '</option>';
    }
    recAddCategorySelect.innerHTML = addOptHtml;
    recCustomAddInput.value = '';

    if (candidatePoolCount) candidatePoolCount.textContent = '(共 ' + allCats.length + ' 个词项' + (!isCandidateManageMode && allCats.indexOf(pos) >= 0 ? '，当前部位不作自身候选' : '') + ')';
    modalCandidateCloud.innerHTML = candidateHtml;
  }

  function closeRecommendModal() {
    recommendModal.classList.remove('show');
    renderSide();
  }

  recPosSelect.addEventListener('change', function () {
    renderCurrentRecPosDetails();
  });

  // 目标部件：增
  btnCreateNewRecPos.addEventListener('click', function () {
    showPromptDialog({
      title: '新建目标部件',
      desc: '请输入新目标部件/规则对象名称：\n（如：避雷针、护栏、隔离开关、跌落式熔断器等）',
      placeholder: '输入部件名称…'
    }).then(function (newPos) {
      if (newPos && newPos.trim()) {
        newPos = newPos.trim();
        if (!locationAdjacency[newPos]) {
          locationAdjacency[newPos] = [];
          saveAdjacency();
        }
        addCandidatePoolItem(newPos);
        openRecommendModal(newPos, 'rec');
        toast('✓ 已新建目标部件规则：【' + newPos + '】');
      }
    });
  });

  // 目标部件：改 (重命名)
  btnRenameCurRecPos.addEventListener('click', function () {
    var curPos = recPosSelect.value;
    if (!curPos) return;
    showPromptDialog({
      title: '重命名目标部件',
      desc: '修改目标部件名称将同步更新推荐规则与分类字典：',
      defaultValue: curPos
    }).then(function (newName) {
      if (newName && newName.trim() && newName.trim() !== curPos) {
        newName = newName.trim();
        var oldList = locationAdjacency[curPos] || [];
        delete locationAdjacency[curPos];
        locationAdjacency[newName] = oldList;

        // 同步更新全局引用
        for (var k in locationAdjacency) {
          var arr = locationAdjacency[k];
          for (var i = 0; i < arr.length; i++) {
            if (arr[i] === curPos) arr[i] = newName;
          }
        }

        renameCandidatePoolItem(curPos, newName);

        if (defectDict[curPos]) {
          defectDict[newName] = defectDict[curPos];
          delete defectDict[curPos];
          saveDefectDict();
        }

        saveAdjacency();
        openRecommendModal(newName, 'rec');
        renderSide();
        toast('✓ 已将目标部件【' + curPos + '】重命名为【' + newName + '】');
      }
    });
  });

  // 目标部件：删
  btnDelCurRecPos.addEventListener('click', function () {
    var curPos = recPosSelect.value;
    if (!curPos) return;
    showConfirmDialog('删除目标部件', '确定要删除目标部件【' + curPos + '】的全部推荐规则吗？').then(function (ok) {
      if (!ok) return;
      delete locationAdjacency[curPos];
      saveAdjacency();
      openRecommendModal('', 'rec');
      renderSide();
      toast('✓ 已删除目标部件【' + curPos + '】的推荐规则');
    });
  });

  // 关联分类：改 (重命名关联分类项) 与 删 (移除关联项)
  recTagContainer.addEventListener('click', function (e) {
    var editChip = e.target.closest('.edit-chip');
    if (editChip) {
      var oldItem = editChip.dataset.item;
      var pos = recPosSelect.value;
      if (pos && oldItem) {
        showPromptDialog({
          title: '修改关联推荐分类',
          defaultValue: oldItem
        }).then(function (newItem) {
          if (newItem && newItem.trim() && newItem.trim() !== oldItem) {
            newItem = newItem.trim();
            var list = locationAdjacency[pos] || [];
            var idx = list.indexOf(oldItem);
            if (idx >= 0) {
              list[idx] = newItem;
              addCandidatePoolItem(newItem);
              saveAdjacency();
              renderCurrentRecPosDetails();
              renderSide();
              toast('✓ 已将推荐项修改为【' + newItem + '】');
            }
          }
        });
      }
      return;
    }

    var delChip = e.target.closest('.del-chip');
    if (delChip) {
      var targetItem = delChip.dataset.item;
      var pos2 = recPosSelect.value;
      if (pos2 && targetItem) {
        removeRecommendationRule(pos2, targetItem);
        renderCurrentRecPosDetails();
        renderSide();
        toast('已从【' + pos2 + '】的推荐中移除【' + targetItem + '】');
      }
    }
  });

  // 关联分类：清空全部
  btnClearAllCurRec.addEventListener('click', function () {
    var pos = recPosSelect.value;
    if (!pos) return;
    showConfirmDialog('清空推荐规则', '确定要清空【' + pos + '】关联的所有推荐分类吗？').then(function (ok) {
      if (!ok) return;
      clearCategoryRecommendations(pos);
      renderCurrentRecPosDetails();
      renderSide();
      toast('✓ 已清空【' + pos + '】的关联推荐');
    });
  });

  /* ---- 候选分类池增、删、改交互实现 ---- */

  // 切换候选词池管理模式
  if (btnToggleCandidateManage) {
    btnToggleCandidateManage.addEventListener('click', function () {
      isCandidateManageMode = !isCandidateManageMode;
      btnToggleCandidateManage.classList.toggle('active', isCandidateManageMode);
      btnToggleCandidateManage.textContent = isCandidateManageMode ? '完成管理' : '管理词池';
      candidatePoolHint.innerHTML = isCandidateManageMode
        ? '<span style="color:var(--accent);font-weight:600">管理模式已开启</span>：点击词项上的修改图标可直接改名，点击删除图标可彻底删除，点击右上角「新增词项」随时添加'
        : '点击下方药丸可直接为当前目标部件添加/移除推荐关联；点击上方「管理词池」可自由改名或删除词项：';
      renderCurrentRecPosDetails();
    });
  }

  // 候选分类池：增
  if (btnAddCandidateItem) {
    btnAddCandidateItem.addEventListener('click', function () {
      showPromptDialog({
        title: '新增候选词项',
        desc: '向候选分类池添加新词项（支持输入多个，用逗号或空格隔开）：\n（例如：避雷针, 氧化锌避雷器, 绝缘横担）',
        placeholder: '输入词项名称…'
      }).then(function (text) {
        if (text && text.trim()) {
          var items = text.split(/[,，、;；\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
          var added = addCandidatePoolItem(items);
          renderCurrentRecPosDetails();
          toast('✓ 已成功向候选分类池添加 ' + added + ' 个新词项！');
        }
      });
    });
  }

  // 候选分类池：恢复默认
  if (btnResetCandidatePool) {
    btnResetCandidatePool.addEventListener('click', function () {
      showConfirmDialog('恢复默认候选词池', '确定要恢复系统默认的候选分类池吗？自定义添加的候选词将被重置。').then(function (ok) {
        if (!ok) return;
        candidatePool = getDefaultCandidatePool();
        saveCandidatePool();
        renderCurrentRecPosDetails();
        toast('✓ 已恢复系统默认候选分类池');
      });
    });
  }

  // 候选池药丸交互（支持点选关联 + 管理模式下改名与删除）
  modalCandidateCloud.addEventListener('click', function (e) {
    var editIcon = e.target.closest('.pill-action.edit');
    if (editIcon) {
      var oldWord = editIcon.dataset.candidate;
      showPromptDialog({
        title: '修改候选分类词',
        defaultValue: oldWord
      }).then(function (newWord) {
        if (newWord && newWord.trim() && newWord.trim() !== oldWord) {
          newWord = newWord.trim();
          renameCandidatePoolItem(oldWord, newWord);
          renderCurrentRecPosDetails();
          renderSide();
          toast('✓ 已将候选词【' + oldWord + '】修改为【' + newWord + '】');
        }
      });
      return;
    }

    var delIcon = e.target.closest('.pill-action.del');
    if (delIcon) {
      var delWord = delIcon.dataset.candidate;
      showConfirmDialog('删除候选词', '确定从候选词池移除【' + delWord + '】吗？已有缺陷分类和推荐规则会保留。').then(function (ok) {
        if (!ok) return;
        if (!removeCandidatePoolItem(delWord)) return;
        renderCurrentRecPosDetails();
        toast('✓ 已从候选池删除【' + delWord + '】');
      });
      return;
    }

    if (isCandidateManageMode) return; // 管理模式下不响应关联点选

    var pill = e.target.closest('.candidate-pill');
    if (pill) {
      var cat = pill.dataset.cat;
      var candidate = pill.dataset.candidate;
      var list = locationAdjacency[cat] || [];
      if (list.indexOf(candidate) >= 0) {
        removeRecommendationRule(cat, candidate);
        toast('已从【' + cat + '】移除【' + candidate + '】');
      } else {
        addRecommendationRule(cat, candidate, recBiDirectionCheck.checked);
        toast('已为【' + cat + '】添加【' + candidate + '】');
      }
      renderCurrentRecPosDetails();
      renderSide();
    }
  });

  // 关联分类：输入框添加 (支持多个以逗号/空格分隔)
  btnDoAddRec.addEventListener('click', function () {
    var pos = recPosSelect.value;
    if (!pos) { toast('请先选择目标部件'); return; }

    var rawInput = (recCustomAddInput.value || '').trim();
    var targets = [];
    if (rawInput) {
      targets = rawInput.split(/[,，、;；\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    } else if (recAddCategorySelect.value) {
      targets = [recAddCategorySelect.value];
    }

    if (targets.length === 0) { toast('请选择或输入要关联推荐的分类名称'); return; }

    var added = addRecommendationRule(pos, targets, recBiDirectionCheck.checked);
    renderCurrentRecPosDetails();
    renderSide();
    toast('已为【' + pos + '】成功添加 ' + added + ' 项关联推荐！');
  });

  btnResetRecDefault.addEventListener('click', function () {
    showConfirmDialog('恢复默认推荐图谱', '确定要恢复系统默认的相近关联推荐图谱吗？自定义推荐规则将被重置。').then(function (ok) {
      if (!ok) return;
      locationAdjacency = JSON.parse(JSON.stringify(DEFAULT_LOCATION_ADJACENCY));
      saveAdjacency();
      renderCurrentRecPosDetails();
      renderSide();
      toast('✓ 已恢复系统默认推荐规则');
    });
  });

  /* ---- 2. 缺陷分类总表管理（分类列表与标签增删改） ---- */

  function renderModalCategoryList() {
    var q = (modalCatSearchInput.value || '').trim().toLowerCase();
    var cats = Object.keys(defectDict).sort(function (a, b) {
      return a.localeCompare(b, 'zh-CN');
    });

    var html = '';
    var matchCount = 0;

    for (var i = 0; i < cats.length; i++) {
      var cat = cats[i];
      var items = defectDict[cat] || [];

      if (q) {
        var matchCat = cat.toLowerCase().indexOf(q) >= 0;
        var matchItem = items.some(function (t) { return t.toLowerCase().indexOf(q) >= 0; });
        if (!matchCat && !matchItem) continue;
      }

      html += '<div class="cat-card-modal" data-category="' + esc(cat) + '">';
      html += '  <div class="cat-card-modal-head">';
      html += '    <span>【' + esc(cat) + '】 <span style="font-size:11px;color:var(--muted);font-weight:normal">(' + items.length + '项标签)</span></span>';
      html += '    <div style="display:flex;align-items:center;gap:4px">';
      html += '      <button class="mini-tool-btn modal-add-tag-btn" data-category="' + esc(cat) + '" title="添加新标签">加标签</button>';
      html += '      <button class="mini-tool-btn modal-edit-cat-btn" data-category="' + esc(cat) + '" title="重命名分类">重命名</button>';
      html += '      <button class="mini-tool-btn modal-del-cat-btn" data-category="' + esc(cat) + '" style="color:var(--accent)" title="删除分类">删除</button>';
      html += '    </div>';
      html += '  </div>';

      html += '  <div class="cat-card-modal-body">';
      if (items.length > 0) {
        for (var j = 0; j < items.length; j++) {
          var t = items[j];
          html += '<span class="modal-def-tag" data-category="' + esc(cat) + '" data-tag="' + esc(t) + '">';
          html += '  <span>' + esc(t) + '</span>';
          html += '  <span class="tag-btn-icon modal-edit-tag" data-category="' + esc(cat) + '" data-tag="' + esc(t) + '" title="修改标签名称">' + ICONS.edit + '</span>';
          html += '  <span class="tag-btn-icon modal-del-tag" data-category="' + esc(cat) + '" data-tag="' + esc(t) + '" title="删除此标签">' + ICONS.close + '</span>';
          html += '</span>';
        }
      } else {
        html += '<span style="font-size:11px;color:var(--muted)">暂无缺陷标签，可点击右上角「加标签」添加</span>';
      }
      html += '  </div>';
      html += '</div>';
      matchCount++;
    }

    if (matchCount === 0) {
      html = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:24px 0">未找到符合搜索条件的缺陷分类</div>';
    }

    modalCatListScroll.innerHTML = html;
  }

  modalCatSearchInput.addEventListener('input', renderModalCategoryList);

  // 分类列表：增
  btnModalCreateCat.addEventListener('click', function () {
    showPromptDialog({
      title: '新建缺陷分类',
      placeholder: '如：接地线、护栏、隔离开关…',
      validate: function (v) {
        if (!v || !v.trim()) return '分类名称不能为空';
        if (defectDict[v.trim()]) return '已存在同名分类';
        return null;
      }
    }).then(function (newCat) {
      if (newCat && newCat.trim()) {
        newCat = newCat.trim();
        defectDict[newCat] = [];
        if (!locationAdjacency[newCat]) locationAdjacency[newCat] = [];
        addCandidatePoolItem(newCat);
        saveDefectDict();
        saveAdjacency();
        renderModalCategoryList();
        renderSide();
        toast('✓ 已新建分类：【' + newCat + '】');
      }
    });
  });

  // 分类列表与标签：改 / 删 / 增
  modalCatListScroll.addEventListener('click', function (e) {
    var addTagBtn = e.target.closest('.modal-add-tag-btn');
    if (addTagBtn) {
      var targetCat = addTagBtn.dataset.category;
      showPromptDialog({
        title: '添加缺陷标签',
        desc: '在【' + targetCat + '】分类下新建缺陷标签（下划线开头）：',
        defaultValue: '_' + targetCat + '-',
        placeholder: '如：_' + targetCat + '-螺母松动',
        validate: function (v) {
          if (!v || !v.trim()) return '标签内容不能为空';
          var tag = v.trim();
          if (tag.charAt(0) !== '_') tag = '_' + tag;
          if (defectDict[targetCat] && defectDict[targetCat].indexOf(tag) >= 0) return '该分类下已存在相同标签';
          return null;
        }
      }).then(function (tagText) {
        if (tagText && tagText.trim()) {
          tagText = tagText.trim();
          if (tagText.charAt(0) !== '_') tagText = '_' + tagText;
          if (!defectDict[targetCat]) defectDict[targetCat] = [];
          defectDict[targetCat].push(tagText);
          saveDefectDict();
          renderModalCategoryList();
          renderSide();
          toast('✓ 已添加标签：' + tagText);
        }
      });
      return;
    }

    var editCatBtn = e.target.closest('.modal-edit-cat-btn');
    if (editCatBtn) {
      var oldCat = editCatBtn.dataset.category;
      showPromptDialog({
        title: '重命名分类',
        desc: '修改分类名称将同步更新全局引用：',
        defaultValue: oldCat,
        validate: function (v) {
          if (!v || !v.trim()) return '分类名称不能为空';
          if (v.trim() !== oldCat && defectDict[v.trim()]) return '已存在同名分类';
          return null;
        }
      }).then(function (newName) {
        if (newName && newName.trim() && newName.trim() !== oldCat) {
          newName = newName.trim();
          var cItems = defectDict[oldCat] || [];
          delete defectDict[oldCat];
          defectDict[newName] = cItems;

          if (locationAdjacency[oldCat]) {
            locationAdjacency[newName] = locationAdjacency[oldCat];
            delete locationAdjacency[oldCat];
          }
          for (var k in locationAdjacency) {
            var arr = locationAdjacency[k];
            for (var a = 0; a < arr.length; a++) {
              if (arr[a] === oldCat) arr[a] = newName;
            }
          }

          renameCandidatePoolItem(oldCat, newName);

          saveDefectDict();
          saveAdjacency();
          renderModalCategoryList();
          renderSide();
          toast('✓ 分类已重命名为：【' + newName + '】');
        }
      });
      return;
    }

    var delCatBtn = e.target.closest('.modal-del-cat-btn');
    if (delCatBtn) {
      var delCat = delCatBtn.dataset.category;
      showConfirmDialog('删除分类', '确定要删除分类【' + delCat + '】及其包含的所有缺陷标签吗？').then(function (ok) {
        if (!ok) return;
        var deletedCategoryTags = defectDict[delCat] || [];
        delete defectDict[delCat];
        for (var dcIdx = 0; dcIdx < deletedCategoryTags.length; dcIdx++) {
          criticalDefects.delete(deletedCategoryTags[dcIdx]);
        }
        saveCriticalDefects();
        delete locationAdjacency[delCat];
        for (var k2 in locationAdjacency) {
          var arr2 = locationAdjacency[k2];
          var iIdx2 = arr2.indexOf(delCat);
          if (iIdx2 >= 0) arr2.splice(iIdx2, 1);
        }
        removeCandidatePoolItem(delCat);
        saveDefectDict();
        saveAdjacency();
        renderModalCategoryList();
        renderSide();
        toast('✓ 已删除分类：【' + delCat + '】');
      });
      return;
    }

    var editTagBtn = e.target.closest('.modal-edit-tag');
    if (editTagBtn) {
      var cat = editTagBtn.dataset.category;
      var oldTag = editTagBtn.dataset.tag;
      showPromptDialog({
        title: '修改缺陷标签',
        desc: '修改【' + cat + '】下的标签名称：',
        defaultValue: oldTag,
        validate: function (v) {
          if (!v || !v.trim()) return '标签名称不能为空';
          return null;
        }
      }).then(function (newTag) {
        if (newTag && newTag.trim() && newTag.trim() !== oldTag) {
          newTag = newTag.trim();
          if (newTag.charAt(0) !== '_') newTag = '_' + newTag;
          if (defectDict[cat]) {
            var idx = defectDict[cat].indexOf(oldTag);
            if (idx >= 0) defectDict[cat][idx] = newTag;
            saveDefectDict();
            renderModalCategoryList();
            renderSide();
            toast('✓ 标签已更新为：' + newTag);
          }
        }
      });
      return;
    }

    var delTagBtn = e.target.closest('.modal-del-tag');
    if (delTagBtn) {
      var cat2 = delTagBtn.dataset.category;
      var dTag = delTagBtn.dataset.tag;
      showConfirmDialog('删除标签', '确定要删除标签【' + dTag + '】吗？').then(function (ok) {
        if (!ok) return;
        if (defectDict[cat2]) {
          var idx2 = defectDict[cat2].indexOf(dTag);
          if (idx2 >= 0) defectDict[cat2].splice(idx2, 1);
          saveDefectDict();
          renderModalCategoryList();
          renderSide();
          toast('✓ 已删除标签：' + dTag);
        }
      });
      return;
    }
  });

  btnCloseRecModalTop.addEventListener('click', closeRecommendModal);
  btnCloseRecModal.addEventListener('click', closeRecommendModal);
  recommendModal.addEventListener('click', function (e) {
    if (e.target === recommendModal) closeRecommendModal();
  });

  /* ================= 分类与标签拖拽排序与移动 ================= */

  function reorderCategory(fromCat, toCat, insertBefore) {
    if (!defectDict[fromCat] || !defectDict[toCat] || fromCat === toCat) return;
    var keys = Object.keys(defectDict);
    var fromIdx = keys.indexOf(fromCat);
    if (fromIdx < 0) return;
    keys.splice(fromIdx, 1);
    var toIdx = keys.indexOf(toCat);
    if (toIdx < 0) toIdx = keys.length;
    var insertIdx = insertBefore ? toIdx : toIdx + 1;
    keys.splice(insertIdx, 0, fromCat);

    var newDict = {};
    for (var i = 0; i < keys.length; i++) {
      newDict[keys[i]] = defectDict[keys[i]];
    }
    defectDict = newDict;
    saveDefectDict();
    renderSide();
    toast('✓ 已调整分类【' + fromCat + '】的位置');
  }

  function moveOrReorderTag(fromCat, fromTag, toCat, targetTag, insertBefore) {
    if (!defectDict[fromCat] || !defectDict[toCat]) return;
    var fromArr = defectDict[fromCat];
    var fromIdx = fromArr.indexOf(fromTag);
    if (fromIdx < 0) return;

    fromArr.splice(fromIdx, 1);

    var toArr = defectDict[toCat];
    if (targetTag) {
      var toIdx = toArr.indexOf(targetTag);
      if (toIdx >= 0) {
        toArr.splice(insertBefore ? toIdx : toIdx + 1, 0, fromTag);
      } else {
        toArr.push(fromTag);
      }
    } else {
      toArr.push(fromTag);
    }

    saveDefectDict();
    renderSide();
    if (fromCat === toCat) {
      toast('✓ 已调整标签顺序');
    } else {
      toast('✓ 已将标签【' + fromTag + '】移动到分类【' + toCat + '】');
    }
  }

  var draggedItem = null;
  var lastDragEndTime = 0;

  sideScroll.addEventListener('dragstart', function (e) {
    if (e.target.closest('.action-icon-btn') || e.target.closest('input')) {
      e.preventDefault();
      return;
    }

    var defItem = e.target.closest('.def-item');
    if (defItem) {
      var dCat = defItem.dataset.category;
      var dTag = defItem.dataset.text;
      draggedItem = { type: 'tag', tag: dTag, cat: dCat, el: defItem };
      defItem.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dTag);
      return;
    }

    var posHeader = e.target.closest('.pos-header');
    if (posHeader) {
      var cCat = posHeader.dataset.category;
      var pGroup = posHeader.closest('.pos-group');
      draggedItem = { type: 'category', cat: cCat, el: pGroup };
      if (pGroup) pGroup.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', cCat);
      return;
    }
  });

  sideScroll.addEventListener('dragend', function () {
    lastDragEndTime = Date.now();
    draggedItem = null;
    document.querySelectorAll('.is-dragging, .drag-over-top, .drag-over-bottom, .drag-over-body').forEach(function (el) {
      el.classList.remove('is-dragging', 'drag-over-top', 'drag-over-bottom', 'drag-over-body');
    });
  });

  sideScroll.addEventListener('dragover', function (e) {
    if (!draggedItem) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    document.querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over-body').forEach(function (el) {
      el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-body');
    });

    if (draggedItem.type === 'category') {
      var targetGroup = e.target.closest('.pos-group');
      if (targetGroup && targetGroup !== draggedItem.el) {
        var rect = targetGroup.getBoundingClientRect();
        var isTop = (e.clientY - rect.top) < (rect.height / 2);
        targetGroup.classList.add(isTop ? 'drag-over-top' : 'drag-over-bottom');
      }
    } else if (draggedItem.type === 'tag') {
      var targetItem = e.target.closest('.def-item');
      var targetBody = e.target.closest('.pos-body');
      if (targetItem && targetItem !== draggedItem.el) {
        var rect2 = targetItem.getBoundingClientRect();
        var isTop2 = (e.clientY - rect2.top) < (rect2.height / 2);
        targetItem.classList.add(isTop2 ? 'drag-over-top' : 'drag-over-bottom');
      } else if (targetBody) {
        targetBody.classList.add('drag-over-body');
      }
    }
  });

  sideScroll.addEventListener('drop', function (e) {
    if (!draggedItem) return;
    e.preventDefault();

    if (draggedItem.type === 'category') {
      var targetGroup = e.target.closest('.pos-group');
      if (targetGroup && targetGroup !== draggedItem.el) {
        var targetCat = targetGroup.dataset.category;
        var rect = targetGroup.getBoundingClientRect();
        var isTop = (e.clientY - rect.top) < (rect.height / 2);
        reorderCategory(draggedItem.cat, targetCat, isTop);
      }
    } else if (draggedItem.type === 'tag') {
      var targetItem = e.target.closest('.def-item');
      var targetBody = e.target.closest('.pos-body');
      if (targetItem && targetItem !== draggedItem.el) {
        var toCat = targetItem.dataset.category;
        var targetTag = targetItem.dataset.text;
        var rect2 = targetItem.getBoundingClientRect();
        var isTop2 = (e.clientY - rect2.top) < (rect2.height / 2);
        moveOrReorderTag(draggedItem.cat, draggedItem.tag, toCat, targetTag, isTop2);
      } else if (targetBody) {
        var toCat2 = targetBody.dataset.category;
        moveOrReorderTag(draggedItem.cat, draggedItem.tag, toCat2, null, false);
      }
    }

    draggedItem = null;
    document.querySelectorAll('.is-dragging, .drag-over-top, .drag-over-bottom, .drag-over-body').forEach(function (el) {
      el.classList.remove('is-dragging', 'drag-over-top', 'drag-over-bottom', 'drag-over-body');
    });
  });

  /* ---- 分类与标签标准小弹窗编辑交互 ---- */

  function createNewCategoryDialog() {
    showPromptDialog({
      title: '新建缺陷分类',
      desc: '请输入新分类名称（将自动加入候选分类池与推荐规则）：',
      placeholder: '如：接地线、护栏、隔离开关…',
      validate: function (v) {
        if (!v || !v.trim()) return '分类名称不能为空';
        if (defectDict[v.trim()]) return '已存在同名分类';
        return null;
      }
    }).then(function (newCat) {
      if (!newCat || !newCat.trim()) return;
      newCat = newCat.trim();
      defectDict[newCat] = [];
      if (!locationAdjacency[newCat]) locationAdjacency[newCat] = [];
      addCandidatePoolItem(newCat);
      saveDefectDict();
      saveAdjacency();
      renderSide();
      toast('✓ 已新建分类：【' + newCat + '】');
    });
  }

  if (btnOpenRecSettings) btnOpenRecSettings.addEventListener('click', function () { settingsPanel.classList.remove('show'); openRecommendModal(); });

  sideScroll.addEventListener('click', function (e) {
    if (Date.now() - lastDragEndTime < 220) return; // 拖拽刚结束时避免误触发点击事件
    if (e.target.closest('#restoreHidden')) { restoreHidden(); return; }

    // 缺陷分类区头部的两个快捷按钮
    if (e.target.closest('#btnSideConfigRec') || e.target.closest('#btnQuickRec')) {
      openRecommendModal();
      return;
    }

    if (e.target.closest('#btnSideAddCat') || e.target.closest('#btnAddNewCategory')) {
      createNewCategoryDialog();
      return;
    }

    var configRelBtn = e.target.closest('.config-rel-btn');
    if (configRelBtn) {
      e.stopPropagation();
      var cPos = configRelBtn.dataset.category;
      openRecommendModal(cPos, 'rec');
      return;
    }

    var editCatBtn = e.target.closest('.edit-cat-btn');
    if (editCatBtn) {
      e.stopPropagation();
      var oldCat = editCatBtn.dataset.category;
      showPromptDialog({
        title: '重命名分类',
        desc: '修改分类名称将同步更新推荐图谱与全局引用：',
        defaultValue: oldCat,
        placeholder: '输入新分类名称…',
        validate: function (v) {
          if (!v || !v.trim()) return '分类名称不能为空';
          if (v.trim() !== oldCat && defectDict[v.trim()]) return '已存在同名分类';
          return null;
        }
      }).then(function (newName) {
        if (!newName || newName.trim() === oldCat) return;
        newName = newName.trim();
        var cItems = defectDict[oldCat] || [];
        delete defectDict[oldCat];
        defectDict[newName] = cItems;

        if (locationAdjacency[oldCat]) {
          locationAdjacency[newName] = locationAdjacency[oldCat];
          delete locationAdjacency[oldCat];
        }
        for (var k in locationAdjacency) {
          var arr = locationAdjacency[k];
          var iIdx = arr.indexOf(oldCat);
          if (iIdx >= 0) arr[iIdx] = newName;
        }

        renameCandidatePoolItem(oldCat, newName);

        saveDefectDict();
        saveAdjacency();
        renderSide();
        toast('✓ 分类已重命名为：【' + newName + '】');
      });
      return;
    }

    var addTagBtn = e.target.closest('.add-to-cat-btn');
    if (addTagBtn) {
      e.stopPropagation();
      var targetCat = addTagBtn.dataset.category;
      showPromptDialog({
        title: '添加缺陷标签',
        desc: '在【' + targetCat + '】分类下新建缺陷标签（下划线开头）：',
        defaultValue: '_' + targetCat + '-',
        placeholder: '如：_' + targetCat + '-螺栓松动',
        validate: function (v) {
          if (!v || !v.trim()) return '标签内容不能为空';
          var tag = v.trim();
          if (tag.charAt(0) !== '_') tag = '_' + tag;
          if (defectDict[targetCat] && defectDict[targetCat].indexOf(tag) >= 0) return '该分类下已存在相同标签';
          return null;
        }
      }).then(function (tagText) {
        if (!tagText || !tagText.trim()) return;
        tagText = tagText.trim();
        if (tagText.charAt(0) !== '_') tagText = '_' + tagText;
        if (!defectDict[targetCat]) defectDict[targetCat] = [];
        defectDict[targetCat].push(tagText);
        saveDefectDict();
        renderSide();
        appendDefect(tagText);
        toast('✓ 已新建标签：' + tagText);
      });
      return;
    }

    var delCatBtn = e.target.closest('.del-cat-btn');
    if (delCatBtn) {
      e.stopPropagation();
      var delCat = delCatBtn.dataset.category;
      showConfirmDialog('删除分类', '确定要删除分类【' + delCat + '】及其包含的所有缺陷标签吗？\n此操作不可恢复。').then(function (ok) {
        if (!ok) return;
        delete defectDict[delCat];
        delete locationAdjacency[delCat];
        for (var k2 in locationAdjacency) {
          var arr2 = locationAdjacency[k2];
          var iIdx2 = arr2.indexOf(delCat);
          if (iIdx2 >= 0) arr2.splice(iIdx2, 1);
        }
        removeCandidatePoolItem(delCat);
        saveDefectDict();
        saveAdjacency();
        renderSide();
        toast('✓ 已删除分类：【' + delCat + '】');
      });
      return;
    }

    var criticalToggleBtn = e.target.closest('.critical-toggle-btn');
    if (criticalToggleBtn) {
      e.stopPropagation();
      toggleCriticalDefect(criticalToggleBtn.dataset.text || '');
      return;
    }

    var editTagBtn = e.target.closest('.edit-tag-btn');
    if (editTagBtn) {
      e.stopPropagation();
      var cat2 = editTagBtn.dataset.category;
      var oldText = editTagBtn.dataset.text;
      showPromptDialog({
        title: '修改缺陷标签',
        desc: '修改【' + cat2 + '】下的标签名称：',
        defaultValue: oldText,
        placeholder: '输入新标签名称…',
        validate: function (v) {
          if (!v || !v.trim()) return '标签名称不能为空';
          return null;
        }
      }).then(function (newText) {
        if (!newText || !newText.trim() || newText.trim() === oldText) return;
        newText = newText.trim();
        if (newText.charAt(0) !== '_') newText = '_' + newText;
        if (defectDict[cat2]) {
          var idx3 = defectDict[cat2].indexOf(oldText);
          if (idx3 >= 0) defectDict[cat2][idx3] = newText;
          if (criticalDefects.has(oldText)) {
            criticalDefects.delete(oldText);
            criticalDefects.add(newText);
            saveCriticalDefects();
          }
          saveDefectDict();
          renderSide();
          toast('✓ 标签已更新为：' + newText);
        }
      });
      return;
    }

    var delTagBtn = e.target.closest('.del-tag-btn');
    if (delTagBtn) {
      e.stopPropagation();
      var dCat = delTagBtn.dataset.category;
      var dText = delTagBtn.dataset.text;
      showConfirmDialog('删除标签', '确定要删除标签【' + dText + '】吗？').then(function (ok) {
        if (!ok) return;
        hideDefect(dText);
        if (criticalDefects.has(dText)) {
          criticalDefects.delete(dText);
          saveCriticalDefects();
        }
        if (defectDict[dCat]) {
          var idx2 = defectDict[dCat].indexOf(dText);
          if (idx2 >= 0) defectDict[dCat].splice(idx2, 1);
          saveDefectDict();
        }
        renderSide();
        toast('✓ 已删除标签：' + dText);
      });
      return;
    }

    var item = e.target.closest('.def-item');
    if (item) {
      var t = item.dataset.text || item.querySelector('.t').textContent;
      appendDefect(t);
    }
  });

  // 点击预览条中的红色缺陷标签徽章直接撤回/移除
  if (previewEl) {
    previewEl.addEventListener('click', function (e) {
      var tagEl = e.target.closest('.preview-tag');
      if (tagEl) {
        var idx = parseInt(tagEl.dataset.idx, 10);
        var name = curName();
        if (name && !isNaN(idx)) {
          var m = getMeta(name);
          if (idx >= 0 && idx < m.appended.length) {
            var removed = m.appended.splice(idx, 1)[0];
            if (m.history) {
              for (var hi = m.history.length - 1; hi >= 0; hi--) {
                if (m.history[hi].type === 'name' && m.history[hi].tag === removed) {
                  m.history.splice(hi, 1);
                  break;
                }
              }
            }
            if (state.markedDefectTags) {
              if (m.appended.length > 0) {
                state.markedDefectTags.set(name, m.appended.join(''));
              } else {
                state.markedDefectTags.delete(name);
              }
            }
            renderSide();
            updateTreeCurrentDefectTag(name, m.appended.length > 0 ? m.appended.join('') : '');
            updateHud();
            toast('已撤回缺陷命名：' + (removed || ''));
          }
        }
      }
    });
  }

  /* ================= 自动双目录保存：输出一张未圈原图到「缺陷原图」，输出一张已圈图到「缺陷圈示图」 ================= */

  function updateOutputButtonText() {
    var name = (output.mainHandle ? output.mainHandle.name : '') || output.mainName || (lastOutputHandle ? lastOutputHandle.name : '') || '';
    if (output.mainHandle) {
      outputDirName.textContent = output.mainHandle.name;
      outputDirName.style.color = 'var(--ok)';
      btnOutput.title = '当前输出目录：' + output.mainHandle.name + '（已连接，点击更换，右键强制选择）';
    } else if (name) {
      outputDirName.textContent = name + ' (点击连接)';
      outputDirName.style.color = 'var(--warn)';
      btnOutput.title = '上次记忆的输出目录：' + name + '（点击直接恢复连接，右键更换新目录）';
    } else {
      outputDirName.textContent = '未设置';
      outputDirName.style.color = 'var(--accent)';
      btnOutput.title = '点击设置或连接保存输出文件夹';
    }
  }

  async function pickOutputDir(forceNewPicker) {
    if (!window.showDirectoryPicker) {
      toast('目录接口未就绪，请关闭并重新打开程序');
      return false;
    }

    // 1. 如果不是强制重新选择，且已有记忆句柄但尚未连接，优先恢复该句柄
    if (!forceNewPicker && lastOutputHandle && !output.mainHandle) {
      try {
        var status = await lastOutputHandle.queryPermission({ mode: 'readwrite' });
        if (status !== 'granted') {
          status = await lastOutputHandle.requestPermission({ mode: 'readwrite' });
        }
        if (status === 'granted') {
          output.mainHandle = lastOutputHandle;
          output.mainName = lastOutputHandle.name || '';
          try { localStorage.setItem(KEY_OUTPUT_NAME, output.mainName); } catch (e) {}
          updateOutputButtonText();
          scanOutputDirectory().catch(function(e) {console.warn(e);});
          toast('✓ 已连接记忆的输出目录：' + output.mainName);
          return true;
        }
      } catch (e) {
        console.warn('恢复输出目录句柄失败，将打开目录选择器:', e);
      }
    }

    // 2. 弹出系统目录选择器（自动定位在上次输出目录或输入目录）
    var opts = { mode: 'readwrite', id: 'xunjian-output' };
    if (lastOutputHandle) opts.startIn = lastOutputHandle;
    else if (lastInputHandle) opts.startIn = lastInputHandle;

    var handle = await window.showDirectoryPicker(opts);
    output.mainHandle = handle;
    output.mainName = handle.name || '';
    lastOutputHandle = handle;
    try { localStorage.setItem(KEY_OUTPUT_NAME, output.mainName); } catch (e) {}
    await saveDirHandle('last_output_handle', handle);
    updateOutputButtonText();
    scanOutputDirectory();
    toast('保存输出目录已设置为：' + output.mainName);
    return true;
  }

  function ensureOutputDir() {
    return new Promise(async function (resolve) {
      if (output.mainHandle) { resolve(true); return; }

      // 优先尝试恢复记忆的输出目录
      if (lastOutputHandle) {
        try {
          var status = await lastOutputHandle.queryPermission({ mode: 'readwrite' });
          if (status !== 'granted') {
            status = await lastOutputHandle.requestPermission({ mode: 'readwrite' });
          }
          if (status === 'granted') {
            output.mainHandle = lastOutputHandle;
            output.mainName = lastOutputHandle.name;
            try { localStorage.setItem(KEY_OUTPUT_NAME, output.mainName); } catch (e) {}
            updateOutputButtonText();
            scanOutputDirectory().catch(function(e) {console.warn(e);});
            resolve(true);
            return;
          }
        } catch (e) {}
      }

      pickOutputDir(true).then(function (ok) { resolve(!!ok); }).catch(function (err) {
        if (err && err.name === 'AbortError') resolve(false);
        else { toast('选择输出文件夹失败：' + (err && err.message || err)); resolve(false); }
      });
    });
  }

  function selectOutputDir() {
    if(ioBusy||saveQueueBusy48()||state.navBusy){toast('请等待保存任务完成');return;}
    if (output.mainHandle) {
      // 已经连接，点击允许更换
      pickOutputDir(true).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        toast('更换失败：' + (err && err.message || err));
      });
    } else {
      // 尚未连接，优先恢复连接
      pickOutputDir(false).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        toast('选择失败：' + (err && err.message || err));
      });
    }
  }

  function composite(img, mime, boxes, width) {
    return new Promise(function(resolve,reject){
      var cv=document.createElement('canvas');
      try{
        cv.width=img.naturalWidth;cv.height=img.naturalHeight;
        var ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
        ctx.strokeStyle='#FF0000';ctx.lineWidth=width===undefined?strokeWidth:width;ctx.lineJoin='miter';
        (boxes||[]).forEach(function(b){ctx.strokeRect(b.x,b.y,b.w,b.h);});
        cv.toBlob(function(blob){cv.width=cv.height=1;if(blob)resolve(blob);else reject(new Error('导出图片失败'));},mime,mime==='image/jpeg'?0.95:undefined);
      }catch(e){cv.width=cv.height=1;reject(e);}
    });
  }
  function exportWorker46(){
    self.onmessage=async function(e){var d=e.data,bmp=null,cv=null;
      try{
        bmp=await createImageBitmap(d.blob);cv=new OffscreenCanvas(bmp.width,bmp.height);
        var ctx=cv.getContext('2d');ctx.drawImage(bmp,0,0);bmp.close();bmp=null;
        ctx.strokeStyle='#FF0000';ctx.lineWidth=d.width;ctx.lineJoin='miter';
        d.boxes.forEach(function(b){ctx.strokeRect(b.x,b.y,b.w,b.h);});
        var blob=await cv.convertToBlob({type:d.mime,quality:0.95});cv.width=cv.height=1;
        self.postMessage({blob:blob});
      }catch(e){self.postMessage({error:String(e.message||e)});}
      finally{if(bmp)bmp.close();if(cv)cv.width=cv.height=1;}
    };
  }
  var exportDisabled46=false;
  async function exportPhoto46(blob,mime,boxes,width){
    if(!boxes.length)return blob;
    mime=mime==='image/png'?'image/png':'image/jpeg';
    if(!exportDisabled46&&window.Worker&&window.OffscreenCanvas&&window.createImageBitmap){
      var url=URL.createObjectURL(new Blob(['('+exportWorker46.toString()+')()'],{type:'text/javascript'})),worker=null,timer;
      try{
        worker=new Worker(url);
        return await new Promise(function(resolve,reject){
          timer=setTimeout(function(){reject(new Error('图片合成超时，请重试'));},120000);
          worker.onmessage=function(e){if(e.data.error)reject(new Error(e.data.error));else resolve(e.data.blob);};
          worker.onerror=function(){exportDisabled46=true;reject(new Error('后台图片合成不可用'));};
          worker.postMessage({blob:blob,mime:mime,boxes:boxes,width:width});
        });
      }catch(e){if(!worker)exportDisabled46=true;if(!exportDisabled46)throw e;}
      finally{clearTimeout(timer);if(worker)worker.terminate();URL.revokeObjectURL(url);}
    }
    var imageUrl=URL.createObjectURL(blob),img=null;
    try{await yield46();img=await loadImageElement(imageUrl);return await composite(img,mime,boxes,width);}
    finally{if(img){img.onload=img.onerror=null;img.src='';}URL.revokeObjectURL(imageUrl);}
  }

  function markBadgeText(name) {
    var c = (state.markedCounts && state.markedCounts.get(name)) || 0;
    return c > 1 ? ('已标*' + c) : '已标';
  }

  function updateTreeAfterSave(name,dTag){VirtualTree48.dirty(state.indexByName.get(name));VirtualTree48.rebuild(false);FastIndex.paint();}

  // saveBothFolders: implementation in i35 reliability section.


  /* ================= 危急缺陷：独立保存，仅写入「危急缺陷」文件夹，与「保存缺陷图片」按钮完全无关联 ================= */

  var CRIT_ICON_DEFAULT = '<svg id="btnCriticalIcon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="display:block"><path d="M12 2 1 21h22L12 2zm0 5.6 7.2 12.4H4.8L12 7.6zM11 10h2v5h-2v-5zm0 6.5h2v2h-2v-2z"/></svg>';
  var CRIT_ICON_SAVED = '<svg id="btnCriticalIcon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.6" fill="none" style="display:block"><path d="M4 12.5l5 5L20 7"/></svg>';

  function updateCriticalButtonState(isSaved) {
    if (!btnCritical) return;
    btnCritical.classList.toggle('saved', !!isSaved);
    btnCritical.innerHTML = (isSaved ? CRIT_ICON_SAVED : CRIT_ICON_DEFAULT) +
      '<span id="btnCriticalLabel" class="label">' + (isSaved ? '已存危急' : '危急缺陷') + '</span>';
    btnCritical.title = isSaved
      ? '已独立保存到「危急缺陷」文件夹。再次点击将用当前圈示图覆盖更新该文件'
      : '独立保存危急缺陷：仅将当前圈示图保存到「危急缺陷」文件夹，普通保存不会删除它；取消整张照片的缺陷标记时会一并撤回';
  }

  // saveCriticalOnly: implementation in i35 reliability section.


  async function cancelCriticalOnlyImpl(origName) {
    origName = origName || curName();
    if (!origName) { toast('未选择任何图片'); return; }
    if (!state.criticalFiles || !state.criticalFiles.has(origName)) {
      toast('该图片尚未独立保存过危急缺陷');
      return;
    }
    var confirmed = await showConfirmDialog(
      '撤回危急缺陷确认',
      '确定要撤回「' + displayName(origName) + '」的危急缺陷保存吗？将仅从「危急缺陷」文件夹中删除对应文件，不影响「缺陷圈示图」与「缺陷原图」。'
    );
    if (!confirmed) return;

    loadingEl.style.display = '';
    try {
      var deletedCount = await deleteExistingDefectOutputs(origName, ['危急缺陷']);
      state.criticalFiles.delete(origName);
      updateHud();
      renderSide();
      toast('✓ 已从「危急缺陷」文件夹删除 ' + deletedCount + ' 个文件');
    } catch (err) {
      toast('撤回失败：' + (err && err.message || err));
    } finally {
      loadingEl.style.display = 'none';
    }
  }

  /* ================= 清除并二次编辑（支持同一照片输出多个不同缺陷） ================= */

  async function clearForSecondaryEditImpl() {
    var name = curName();
    if (!name) { toast('未打开任何图片'); return; }
    var m = getMeta(name);
    m.boxes = [];
    m.appended = [];
    m.history = [];
    m.isSecondaryEdit = true;
    m.desktopBakedCount50 = 0;
    m.tagsCleared = true;
    m.saved = false;
    selectedIndex = -1;
    updateTreeCurrentDefectTag(name, '');

    // 二次编辑时切回纯净原图以供重新圈示
    dropImage(name);
    loadingEl.style.display = '';
    try {
      var c = await getImage(state.index, true);
      state.natural = { w: c.img.naturalWidth, h: c.img.naturalHeight };
      var fit = computeFit(c.img.naturalWidth, c.img.naturalHeight);
      fitView(fit.w, fit.h, fit.s);
      render();
    } catch (err) {} finally {
      loadingEl.style.display = 'none';
    }

    renderSide(true);
    updateHud();
    toast('✓ 已清除并切换至纯净原图，可重新圈示与选标签（二次保存不会覆盖原有保存）');
  }

  /* ================= 红框：指针交互与删除 ================= */

  var selectedIndex = -1;
  var mode = 'idle';
  var dragBox = null, dragData = null, lastP = null, rafPending = false, panStart = null;
  var clickStartScreen = null;
  var CLICK_NAV_THRESHOLD = 5; // 判定"单击(切图)"与"拖动(圈图/移动)"的像素阈值

  function normalize(b) {
    var x = b.x, y = b.y, w = b.w, h = b.h;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    return { x: x, y: y, w: w, h: h };
  }
  function clampBox(b) {
    var nw = state.natural.w, nh = state.natural.h;
    if (!nw || !nh) return b;
    var x1 = Math.max(0, Math.min(b.x, nw)), y1 = Math.max(0, Math.min(b.y, nh));
    var x2 = Math.max(0, Math.min(b.x + b.w, nw)), y2 = Math.max(0, Math.min(b.y + b.h, nh));
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  }
  function screenToOrig(px) { var eff = state.view.s * state.view.zoom; return px / (eff || 1); }
  function hitHandle(b, p) {
    var r = screenToOrig(HANDLE_PX);
    var cx = b.x, cy = b.y, x2 = b.x + b.w, y2 = b.y + b.h;
    var pts = [['nw',cx,cy],['ne',x2,cy],['sw',cx,y2],['se',x2,y2],['n',(cx+x2)/2,cy],['s',(cx+x2)/2,y2],['w',cx,(cy+y2)/2],['e',x2,(cy+y2)/2]];
    for (var i = 0; i < pts.length; i++) { var dx = p.x - pts[i][1], dy = p.y - pts[i][2]; if (dx * dx + dy * dy <= r * r) return pts[i][0]; }
    return null;
  }
  function hitDeleteBtn(b, p) {
    var v = state.view;
    var s = v.s;
    var x2 = b.x * s + b.w * s, cy = b.y * s;
    var btnR = 13 / v.zoom;
    var btnX = (x2 + (10 / v.zoom) + (2 / v.zoom)) / s;
    var btnY = (cy - (10 / v.zoom) - (2 / v.zoom)) / s;
    var dx = p.x - btnX, dy = p.y - btnY;
    return (dx * dx + dy * dy) <= (btnR / s) * (btnR / s);
  }
  function hitBox(boxes, p) {
    var tol = screenToOrig(4);
    for (var i = boxes.length - 1; i >= 0; i--) { var b = boxes[i]; if (p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol) return i; }
    return -1;
  }
  function resizeBox(b, handle, p) {
    var x = b.x, y = b.y, x2 = b.x + b.w, y2 = b.y + b.h, min = 3;
    var mL = handle === 'nw' || handle === 'w' || handle === 'sw';
    var mR = handle === 'ne' || handle === 'e' || handle === 'se';
    var mT = handle === 'nw' || handle === 'n' || handle === 'ne';
    var mB = handle === 'sw' || handle === 's' || handle === 'se';
    var nx = x, ny = y, nx2 = x2, ny2 = y2;
    if (mL) nx = Math.min(p.x, x2 - min);
    if (mR) nx2 = Math.max(p.x, x + min);
    if (mT) ny = Math.min(p.y, y2 - min);
    if (mB) ny2 = Math.max(p.y, y + min);
    return clampBox({ x: Math.min(nx, nx2), y: Math.min(ny, ny2), w: Math.abs(nx2 - nx), h: Math.abs(ny2 - ny) });
  }
  function moveBox(b, dx, dy) { return clampBox({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }); }
  function handleCursor(h) {
    if (h === 'nw' || h === 'se') return 'nwse-resize';
    if (h === 'ne' || h === 'sw') return 'nesw-resize';
    if (h === 'n' || h === 's') return 'ns-resize';
    return 'ew-resize';
  }
  function toFit(e) {
    var rect = getCanvasRect();
    var mx = e.clientX - rect.left, my = e.clientY - rect.top;
    var v = state.view;
    return { x: (mx - v.cx - v.panX) / v.zoom + v.cx, y: (my - v.cy - v.panY) / v.zoom + v.cy };
  }
  function toOriginal(e) { var f = toFit(e); var s = state.view.s || 1; return { x: f.x / s, y: f.y / s }; }
  function clampZoom(z) { return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)); }
  function zoomAt(mx, my, factor) {
    var v = state.view;
    var nz = clampZoom(v.zoom * factor);
    if (nz === v.zoom) return;
    var ix = (mx - v.cx - v.panX) / v.zoom + v.cx, iy = (my - v.cy - v.panY) / v.zoom + v.cy;
    v.panX = mx - v.cx - (ix - v.cx) * nz;
    v.panY = my - v.cy - (iy - v.cy) * nz;
    v.zoom = nz;
    render();
    detail38();
  }
  function scheduleRedraw(fn) { if (!rafPending) { rafPending = true; requestAnimationFrame(function () { rafPending = false; fn(); }); } }
  function applyInteraction() {
    if (mode === 'draw' && dragBox && lastP) {
      dragBox.w = lastP.x - dragBox.x; dragBox.h = lastP.y - dragBox.y; renderOverlay();
    } else if (mode === 'move' && dragData && lastP) {
      var boxes = getMeta(curName()).boxes;
      if (selectedIndex >= 0 && selectedIndex < boxes.length) { boxes[selectedIndex] = moveBox(dragData.orig, lastP.x - dragData.startP.x, lastP.y - dragData.startP.y); renderOverlay(); }
    } else if (mode === 'resize' && dragData && lastP) {
      var boxes2 = getMeta(curName()).boxes;
      if (selectedIndex >= 0 && selectedIndex < boxes2.length) { boxes2[selectedIndex] = resizeBox(dragData.orig, dragData.handle, lastP); renderOverlay(); }
    } else if (mode === 'pan') { render(); }
  }
  function updateHoverCursor(e) {
    if (state.index < 0) return;
    var f = toFit(e);
    if (f.x < 0 || f.y < 0 || f.x > state.view.w || f.y > state.view.h) { overlayCanvas.style.cursor = 'default'; return; }
    var p = { x: f.x / state.view.s, y: f.y / state.view.s };
    var name = curName(), boxes = name ? getMeta(name).boxes : null;
    if (boxes) {
      if (selectedIndex >= 0 && selectedIndex < boxes.length) {
        if (hitDeleteBtn(boxes[selectedIndex], p)) { overlayCanvas.style.cursor = 'pointer'; return; }
        var h = hitHandle(boxes[selectedIndex], p);
        if (h) { overlayCanvas.style.cursor = handleCursor(h); return; }
      }
      if (hitBox(boxes, p) >= 0) { overlayCanvas.style.cursor = 'move'; return; }
    }
    overlayCanvas.style.cursor = 'crosshair';
  }

  function deleteSelectedBox() {
    if(editLocked48())return;
    if (state.index < 0) return;
    var name = curName();
    if (!name) return;
    var m = getMeta(name);
    if (selectedIndex >= 0 && selectedIndex < m.boxes.length) {
      m.boxes.splice(selectedIndex, 1);
      m.saved = false;
      selectedIndex = -1;
      renderOverlay();
      updateHud();
      toast('已删除选中的红框');
    } else if (m.boxes.length > 0) {
      m.boxes.pop();
      m.saved = false;
      selectedIndex = -1;
      renderOverlay();
      updateHud();
      toast('已删除最近绘制的红框');
    } else {
      toast('当前没有可删除的红框');
    }
  }

  overlayCanvas.addEventListener('pointerenter', invalidateCanvasRect);
  overlayCanvas.addEventListener('pointerdown', function (e) {
    Motion.stopPhoto();
    if(editLocked48()||!currentImage())return;
    if (state.index < 0) return;
    if (e.button === 2) {
      e.preventDefault(); mode = 'pan';
      panStart = { x: e.clientX, y: e.clientY, panX: state.view.panX, panY: state.view.panY };
      clickStartScreen = { x: e.clientX, y: e.clientY };
      overlayCanvas.style.cursor = 'grabbing';
      try { overlayCanvas.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    if (e.button !== 0) return;
    var f = toFit(e);
    if (f.x < 0 || f.y < 0 || f.x > state.view.w || f.y > state.view.h) return;
    var p = { x: f.x / state.view.s, y: f.y / state.view.s };
    var name = curName(), boxes = name ? getMeta(name).boxes : null;
    if (!boxes) return;

    if (selectedIndex >= 0 && selectedIndex < boxes.length) {
      if (hitDeleteBtn(boxes[selectedIndex], p)) {
        e.preventDefault();
        deleteSelectedBox();
        return;
      }
      var h = hitHandle(boxes[selectedIndex], p);
      if (h) {
        mode = 'resize'; var sb = boxes[selectedIndex];
        dragData = { orig: { x: sb.x, y: sb.y, w: sb.w, h: sb.h }, handle: h, startP: p };
        overlayCanvas.style.cursor = handleCursor(h);
        try { overlayCanvas.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault(); return;
      }
    }

    var idx = hitBox(boxes, p);
    if (idx >= 0) {
      selectedIndex = idx; mode = 'move';
      var mb = boxes[idx];
      dragData = { orig: { x: mb.x, y: mb.y, w: mb.w, h: mb.h }, startP: p };
      overlayCanvas.style.cursor = 'move';
      renderOverlay();
      try { overlayCanvas.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault(); return;
    }

    selectedIndex = -1; mode = 'draw';
    dragBox = { x: p.x, y: p.y, w: 0, h: 0 }; lastP = p;
    clickStartScreen = { x: e.clientX, y: e.clientY };
    overlayCanvas.style.cursor = 'crosshair';
    try { overlayCanvas.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });

  overlayCanvas.addEventListener('pointermove', function (e) {
    if (mode === 'pan') {
      state.view.panX = panStart.panX + (e.clientX - panStart.x);
      state.view.panY = panStart.panY + (e.clientY - panStart.y);
      scheduleRedraw(applyInteraction); return;
    }
    if (mode === 'idle') { updateHoverCursor(e); return; }
    lastP = toOriginal(e);
    scheduleRedraw(applyInteraction);
  });

  function endInteraction(e) {
    var modified = false;
    var clickDist = clickStartScreen ? Math.hypot(e.clientX - clickStartScreen.x, e.clientY - clickStartScreen.y) : Infinity;
    if (mode === 'draw') {
      var p = toOriginal(e);
      dragBox.w = p.x - dragBox.x; dragBox.h = p.y - dragBox.y;
      var norm = clampBox(normalize(dragBox)); dragBox = null;
      if (norm.w >= 3 && norm.h >= 3) {
        var meta = getMeta(curName());
        meta.boxes.push(norm);
        meta.saved = false;
        selectedIndex = meta.boxes.length - 1;
        meta.history.push({ type: 'box' });
        modified = true;
      } else if (mouseClickNavEnabled && clickDist < CLICK_NAV_THRESHOLD) {
        clickStartScreen = null;
        mode = 'idle'; dragData = null; lastP = null;
        navNext();
        return;
      }
      renderOverlay(); updateHud();
    } else if (mode === 'move' || mode === 'resize') {
      var meta = getMeta(curName());
      meta.saved = false;
      modified = true;
      renderOverlay(); updateHud();
    } else if (mode === 'pan') {
      if (mouseClickNavEnabled && clickDist < CLICK_NAV_THRESHOLD) {
        overlayCanvas.style.cursor = 'crosshair';
        clickStartScreen = null;
        mode = 'idle'; dragData = null; lastP = null;
        navPrev();
        return;
      }
    }
    if (mode === 'pan') overlayCanvas.style.cursor = 'crosshair';
    clickStartScreen = null;
    mode = 'idle'; dragData = null; lastP = null;
  }
  overlayCanvas.addEventListener('pointerup', endInteraction);
  overlayCanvas.addEventListener('pointercancel', function () {
    if ((mode === 'move' || mode === 'resize') && dragData) {
      var boxes = getMeta(curName()).boxes;
      if (selectedIndex >= 0 && selectedIndex < boxes.length) boxes[selectedIndex] = dragData.orig;
    }
    if (mode === 'pan') overlayCanvas.style.cursor = 'crosshair';
    clickStartScreen = null;
    mode = 'idle'; dragData = null; dragBox = null; lastP = null; renderOverlay();
  });
  overlayCanvas.addEventListener('wheel', function (e) {
    if (state.index < 0) return;
    e.preventDefault();
    var rect = overlayCanvas.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });
  overlayCanvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  overlayCanvas.addEventListener('dblclick', function () { if (state.index < 0) return; fitView(state.view.w, state.view.h, state.view.s); render(); });

  function undoLastAction() {
    if(editLocked48())return;
    if (state.index < 0) return;
    var name = curName();
    if (!name) return;
    var m = getMeta(name);

    if (m.history && m.history.length > 0) {
      var lastAct = m.history.pop();
      if (lastAct.type === 'name') {
        var removedTag = m.appended.pop();
        if (state.markedDefectTags) {
          if (m.appended.length > 0) {
            state.markedDefectTags.set(name, m.appended.join(''));
          } else {
            state.markedDefectTags.delete(name);
          }
        }
        renderSide();
        renderPathTree(false);
        updateHud();
        toast('已撤回追加的缺陷命名：' + (removedTag || ''));
        return;
      } else if (lastAct.type === 'box') {
        if (m.boxes.length > 0) {
          m.boxes.pop();
          m.saved = false;
          if (selectedIndex >= m.boxes.length) selectedIndex = -1;
          renderOverlay();
          updateHud();
          toast('已撤回最近绘制的红框');
          return;
        }
      }
    }

    if (m.appended && m.appended.length > 0) {
      var remName = m.appended.pop();
      if (state.markedDefectTags) {
        if (m.appended.length > 0) {
          state.markedDefectTags.set(name, m.appended.join(''));
        } else {
          state.markedDefectTags.delete(name);
        }
      }
      renderSide();
      renderPathTree(false);
      updateHud();
      toast('已撤回追加的缺陷命名：' + (remName || ''));
      return;
    }
    if (m.boxes && m.boxes.length > 0) {
      m.boxes.pop();
      if (selectedIndex >= m.boxes.length) selectedIndex = -1;
      renderOverlay();
      updateHud();
      toast('已撤回最近绘制的红框');
      return;
    }

    toast('没有可撤回的操作');
  }

  /* ================= 主题 / 设置 ================= */

  function applyTheme() {
    Motion.theme();
    var NEW_THEMES49=['sakura','void','moonpalm','spectrum'],ALWAYS_DARK49=['void','moonpalm'];
    var allowed=['light','ocean','forest','purple','sunset','slate','rose'].concat(NEW_THEMES49);
    if(!allowed.includes(colorTheme))colorTheme='light';
    allowed.forEach(function(c){document.body.classList.remove('theme-'+c);});
    var forcedDark49=ALWAYS_DARK49.indexOf(colorTheme)>=0,isDark49=theme==='dark'||forcedDark49;
    document.body.classList.toggle('dark',isDark49);
    document.body.classList.toggle('themed49',NEW_THEMES49.indexOf(colorTheme)>=0);
    if(colorTheme!=='light')document.body.classList.add('theme-'+colorTheme);
    themeSwitch.classList.toggle('on',isDark49);themeSwitch.setAttribute('aria-pressed',String(isDark49));themeSwitch.setAttribute('aria-label','黑夜模式');themeSwitch.disabled=forcedDark49;themeSwitch.title=forcedDark49?'此主题本身为深色夜景，无需切换':'';
    if($('themeSelect'))$('themeSelect').value=colorTheme;
    var THEME_DESC49={sakura:'樱·富士：以富士山与樱花实景为背景，工具栏与侧栏自画面渐隐；配合黑夜模式即为夜樱。',void:'黑洞·深空：星尘旋涡实景铺满空白页与工作区，纯黑界面，本身为深色主题。',moonpalm:'月夜·椰影：满月与椰影实景，月光金点缀，本身为深色主题。',spectrum:'光谱·彩虹：干净底色，彩虹色带图用作分隔线、选中标记与背景色带；可配合黑夜模式。'};
    if($('themeDesc49'))$('themeDesc49').textContent=THEME_DESC49[colorTheme]||'';
  }

  /* ================= 持久化 ================= */

  function loadPersisted() {
    try { theme = localStorage.getItem(KEY_THEME) || 'light'; colorTheme=localStorage.getItem('xunjian_color_theme')||'light'; } catch (e) {}
    try {
      output.mainName = localStorage.getItem(KEY_OUTPUT_NAME) || '';
      if (output.mainName && outputDirName) outputDirName.textContent = output.mainName;
    } catch (e) {}
    try {
      var savedLeftW = parseInt(localStorage.getItem(KEY_LEFT_WIDTH), 10);
      if (!isNaN(savedLeftW) && savedLeftW >= 240) applyLeftWidth(savedLeftW);
    } catch (e) {}
    try {
      var savedRightW = parseInt(localStorage.getItem(KEY_RIGHT_WIDTH), 10);
      if (!isNaN(savedRightW) && savedRightW >= 220) applyRightWidth(savedRightW);
    } catch (e) {}
    try {
      var savedStroke = parseInt(localStorage.getItem(KEY_STROKE), 10);
      if (!isNaN(savedStroke) && savedStroke >= 2 && savedStroke <= 50) {
        strokeWidth = savedStroke;
      }
    } catch (e) {}
    if (strokeSlider) strokeSlider.value = strokeWidth;
    try {
      savedInputName = localStorage.getItem(KEY_INPUT_NAME) || '';
      if (savedInputName) updateFolderButtonText();
    } catch (e) {}
    try {
      var savedPrevKey = localStorage.getItem(KEY_NAV_PREV_KEY);
      if (savedPrevKey) customPrevKey = savedPrevKey;
      var savedNextKey = localStorage.getItem(KEY_NAV_NEXT_KEY);
      if (savedNextKey) customNextKey = savedNextKey;
      var savedSaveKey = localStorage.getItem(KEY_NAV_SAVE_KEY);
      if (savedSaveKey) customSaveKey = savedSaveKey;
    } catch (e) {}
    updateNavKeyButtons();
    try {
      var savedMouseEnabled = localStorage.getItem(KEY_MOUSE_SIDE_ENABLED);
      if (savedMouseEnabled !== null) mouseSideEnabled = savedMouseEnabled === '1';
      var savedPrevMouseBtn = parseInt(localStorage.getItem(KEY_MOUSE_PREV_BTN), 10);
      if (!isNaN(savedPrevMouseBtn)) customPrevMouseBtn = savedPrevMouseBtn;
      var savedNextMouseBtn = parseInt(localStorage.getItem(KEY_MOUSE_NEXT_BTN), 10);
      if (!isNaN(savedNextMouseBtn)) customNextMouseBtn = savedNextMouseBtn;
    } catch (e) {}
    updateMouseKeyButtons();
    if (mouseSideSwitch) mouseSideSwitch.classList.toggle('on', mouseSideEnabled);
    try {
      var savedClickNav = localStorage.getItem(KEY_MOUSE_CLICK_NAV_ENABLED);
      if (savedClickNav !== null) mouseClickNavEnabled = savedClickNav === '1';
    } catch (e) {}
    if (mouseClickNavSwitch) mouseClickNavSwitch.classList.toggle('on', mouseClickNavEnabled);

    loadHidden();
    loadDefectDict();
    loadCriticalDefects();
    loadAdjacency();
    loadViewedPhotos();
    loadCandidatePool();
  }

  /* ================= 目录记忆探测与自动连接 ================= */

  async function initDirectoryMemory() {
    try {
      savedInputName = localStorage.getItem(KEY_INPUT_NAME) || '';
      output.mainName = localStorage.getItem(KEY_OUTPUT_NAME) || '';

      lastInputHandle = await getDirHandle('last_input_handle');
      lastOutputHandle = await getDirHandle('last_output_handle');

      if (lastInputHandle && lastInputHandle.name) savedInputName = lastInputHandle.name;
      if (lastOutputHandle && lastOutputHandle.name) output.mainName = lastOutputHandle.name;

      updateFolderButtonText();
      updateOutputButtonText();
      updateEmptyScreenRestoreButton();

      // 静默探测输出目录权限
      if (lastOutputHandle) {
        try {
          var outStatus = await lastOutputHandle.queryPermission({ mode: 'readwrite' });
          if (outStatus === 'granted') {
            output.mainHandle = lastOutputHandle;
            output.mainName = lastOutputHandle.name;
            updateOutputButtonText();
            scanOutputDirectory().catch(function(e) {console.warn(e);});
          }
        } catch (e) {}
      }

      // 静默探测输入目录权限（若已被浏览器授权，则直接自动加载全部照片）
      if (lastInputHandle && state.files.length === 0) {
        try {
          var inStatus = await lastInputHandle.queryPermission({ mode: 'readwrite' });
          if (inStatus === 'granted') {
            loadingEl.style.display = '';
            var entries = [];
            await scanImagesRecursive(lastInputHandle, entries, '');
            loadingEl.style.display = 'none';
            if (entries.length > 0) {
              await setupFiles(entries, 'fs', lastInputHandle);
              toast('✓ 已自动恢复记忆的输入目录：' + lastInputHandle.name);
            }
          }
        } catch (e) {
          loadingEl.style.display = 'none';
        }
      }
    } catch (e) {
      console.warn('initDirectoryMemory failed:', e);
    }
  }

  /* ================= 事件绑定 ================= */

  btnFolder.addEventListener('click', function () {
    if (state.files.length > 0) {
      pickFolder(true); // 已有打开的照片，点击即为更换
    } else {
      pickFolder(false); // 尚未载入，优先恢复记忆目录
    }
  });
  btnFolder.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    pickFolder(true); // 右键强制打开选择器更换目录
  });

  btnEmptyPick.addEventListener('click', function () {
    var hasSaved = !!(savedInputName || (lastInputHandle && lastInputHandle.name));
    pickFolder(hasSaved);
  });
  if (btnEmptyRestore) {
    btnEmptyRestore.addEventListener('click', function () {
      pickFolder(false);
    });
  }

  btnOutput.addEventListener('click', function () { selectOutputDir(); });
  btnOutput.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    pickOutputDir(true).catch(function () {});
  });

  var btnMoreTools = $('btnMoreTools'), moreToolsMenu = $('moreToolsMenu');
  if (btnMoreTools && moreToolsMenu) {
    btnMoreTools.addEventListener('click', function (e) {
      e.stopPropagation();
      var willShow = !moreToolsMenu.classList.contains('show');
      if (willShow) {
        var r = btnMoreTools.getBoundingClientRect();
        moreToolsMenu.style.top = (r.bottom + 4) + 'px';
        moreToolsMenu.style.left = r.left + 'px';
      }
      moreToolsMenu.classList.toggle('show', willShow);
      btnMoreTools.classList.toggle('open', willShow);
    });
    moreToolsMenu.addEventListener('click', function (e) {
      if (e.target && e.target.tagName === 'BUTTON') {
        moreToolsMenu.classList.remove('show');
        btnMoreTools.classList.remove('open');
      }
    });
    document.addEventListener('click', function (e) {
      if (!moreToolsMenu.contains(e.target) && e.target !== btnMoreTools) {
        moreToolsMenu.classList.remove('show');
        btnMoreTools.classList.remove('open');
      }
    });
  }

  function navNext() {
    var nextIdx = getNextFilteredIndex(requestedIndex >= 0 ? requestedIndex : state.index, 1);
    if (nextIdx >= 0) {
      switchTo(nextIdx);
    } else {
      var msg = (filterMode === 'all') ? '已是最后一张照片' :
                (filterMode === 'marked' ? '已是最后一张已标记照片' :
                (filterMode === 'unmarked' ? '已是最后一张未标记照片' : '已是最后一张未看照片'));
      toast(msg);
    }
  }

  function navPrev() {
    var prevIdx = getNextFilteredIndex(requestedIndex >= 0 ? requestedIndex : state.index, -1);
    if (prevIdx >= 0) {
      switchTo(prevIdx);
    } else {
      var msg = (filterMode === 'all') ? '已是第一张照片' :
                (filterMode === 'marked' ? '已是第一张已标记照片' :
                (filterMode === 'unmarked' ? '已是第一张未标记照片' : '已是第一张未看照片'));
      toast(msg);
    }
  }

  btnPrev.addEventListener('click', navPrev);
  btnNext.addEventListener('click', navNext);

  if (btnBottomSave) btnBottomSave.addEventListener('click', function () { saveBothFolders(); });
  if (btnClearSecondary) btnClearSecondary.addEventListener('click', function () { clearForSecondaryEdit(); });
  if (btnCritical) btnCritical.addEventListener('click', function () { saveCriticalOnly(); });

  if (strokeSlider) {
    strokeSlider.addEventListener('input', function (e) {
      strokeWidth = parseInt(e.target.value, 10) || 10;
      if (strokeVal) strokeVal.textContent = strokeWidth + 'px';
      try { localStorage.setItem(KEY_STROKE, String(strokeWidth)); } catch (err) {}
      renderOverlay();
    });
  }

  var sideSearchFrame=0;
  if (searchInput) searchInput.addEventListener('input', function () { if(sideSearchFrame)return;sideSearchFrame=requestAnimationFrame(function(){sideSearchFrame=0;renderSide();}); });
  if (searchClear) {
    searchClear.addEventListener('click', function () {
      if (searchInput) searchInput.value = '';
      renderSide();
      if (searchInput) searchInput.focus();
    });
  }
  var btnFilterCritical = $('btnFilterCritical');
  if (btnFilterCritical) {
    btnFilterCritical.addEventListener('click', function () {
      if (searchInput) {
        if (searchInput.value === '危急' || searchInput.value === '危急缺陷') {
          searchInput.value = '';
        } else {
          searchInput.value = '危急';
        }
        renderSide();
        searchInput.focus();
      }
    });
  }

  /* ================= 图片切换按键自定义绑定 ================= */

  var RESERVED_NAV_KEYS = [' ', 'delete', 'backspace', 'escape', 'enter', 'c'];

  function keyDisplayName(k) {
    if (!k) return '';
    var map = { ' ': '空格', 'arrowleft': '←', 'arrowright': '→', 'arrowup': '↑', 'arrowdown': '↓', 'escape': 'Esc', 'enter': 'Enter', 'tab': 'Tab' };
    var lower = String(k).toLowerCase();
    if (map[lower]) return map[lower];
    if (k.length === 1) return k.toUpperCase();
    return k;
  }

  function updateNavKeyButtons() {
    if (btnBindPrevKey) btnBindPrevKey.textContent = keyDisplayName(customPrevKey);
    if (btnBindNextKey) btnBindNextKey.textContent = keyDisplayName(customNextKey);
    if (btnBindSaveKey) btnBindSaveKey.textContent = keyDisplayName(customSaveKey);
  }

  function bindKeyCapture(button, which) {
    if (!button) return;
    var prevLabel = button.textContent;
    button.textContent = '请按键…';
    button.disabled = true;
    var finished = false;
    function cleanup() {
      finished = true;
      window.removeEventListener('keydown', handler, true);
      button.disabled = false;
    }
    function handler(e) {
      if (finished) return;
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      if (e.key === 'Escape') { updateNavKeyButtons(); return; }
      var lower = e.key.toLowerCase();
      if (e.ctrlKey || e.altKey || e.metaKey || RESERVED_NAV_KEYS.indexOf(lower) >= 0) {
        toast('该按键不可用（已被占用或为组合键），请重新选择');
        updateNavKeyButtons();
        return;
      }
      var others = [];
      if (which !== 'prev') others.push(customPrevKey);
      if (which !== 'next') others.push(customNextKey);
      if (which !== 'save') others.push(customSaveKey);
      if (others.indexOf(lower) >= 0) {
        toast('该按键已绑定给其他功能，请选择其他按键');
        updateNavKeyButtons();
        return;
      }
      if (which === 'prev') {
        customPrevKey = lower;
        try { localStorage.setItem(KEY_NAV_PREV_KEY, lower); } catch (err) {}
      } else if (which === 'next') {
        customNextKey = lower;
        try { localStorage.setItem(KEY_NAV_NEXT_KEY, lower); } catch (err) {}
      } else if (which === 'save') {
        customSaveKey = lower;
        try { localStorage.setItem(KEY_NAV_SAVE_KEY, lower); } catch (err) {}
      }
      updateNavKeyButtons();
      toast('✓ 已绑定「' + keyDisplayName(e.key) + '」');
    }
    window.addEventListener('keydown', handler, true);
  }

  if (btnBindPrevKey) btnBindPrevKey.addEventListener('click', function () { bindKeyCapture(btnBindPrevKey, 'prev'); });
  if (btnBindNextKey) btnBindNextKey.addEventListener('click', function () { bindKeyCapture(btnBindNextKey, 'next'); });
  if (btnBindSaveKey) btnBindSaveKey.addEventListener('click', function () { bindKeyCapture(btnBindSaveKey, 'save'); });
  if (btnResetNavKeys) {
    btnResetNavKeys.addEventListener('click', function () {
      customPrevKey = 'a';
      customNextKey = 'd';
      try { localStorage.removeItem(KEY_NAV_PREV_KEY); localStorage.removeItem(KEY_NAV_NEXT_KEY); } catch (err) {}
      updateNavKeyButtons();
      toast('✓ 已恢复默认按键 A / D');
    });
  }
  if (btnResetSaveKey) {
    btnResetSaveKey.addEventListener('click', function () {
      customSaveKey = 'f';
      try { localStorage.removeItem(KEY_NAV_SAVE_KEY); } catch (err) {}
      updateNavKeyButtons();
      toast('✓ 已恢复默认保存按键 F');
    });
  }

  /* ================= 鼠标侧键自定义绑定（如罗技 G304 前进/后退侧键） ================= */

  function mouseBtnDisplayName(n) {
    var map = { 3: '侧键·后退', 4: '侧键·前进' };
    if (map[n]) return map[n];
    return '按钮' + n;
  }

  function updateMouseKeyButtons() {
    if (btnBindPrevMouse) btnBindPrevMouse.textContent = mouseBtnDisplayName(customPrevMouseBtn);
    if (btnBindNextMouse) btnBindNextMouse.textContent = mouseBtnDisplayName(customNextMouseBtn);
  }

  function bindMouseCapture(button, which) {
    if (!button) return;
    button.textContent = '请按下鼠标侧键…';
    button.disabled = true;
    var finished = false;
    function cleanup() {
      finished = true;
      window.removeEventListener('mousedown', handler, true);
      window.removeEventListener('keydown', escHandler, true);
      button.disabled = false;
    }
    function escHandler(e) {
      if (e.key === 'Escape') { cleanup(); updateMouseKeyButtons(); }
    }
    function handler(e) {
      if (finished) return;
      if (e.button === 0 || e.button === 1 || e.button === 2) {
        toast('请按下鼠标的侧键（前进/后退键），而非左/中/右键');
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      var btnNum = e.button;
      var other = which === 'prev' ? customNextMouseBtn : customPrevMouseBtn;
      if (btnNum === other) {
        toast('该鼠标按键已绑定给另一个方向，请选择其他侧键');
        updateMouseKeyButtons();
        return;
      }
      if (which === 'prev') {
        customPrevMouseBtn = btnNum;
        try { localStorage.setItem(KEY_MOUSE_PREV_BTN, String(btnNum)); } catch (err) {}
      } else {
        customNextMouseBtn = btnNum;
        try { localStorage.setItem(KEY_MOUSE_NEXT_BTN, String(btnNum)); } catch (err) {}
      }
      updateMouseKeyButtons();
      toast('✓ 已绑定「' + mouseBtnDisplayName(btnNum) + '」');
    }
    window.addEventListener('mousedown', handler, true);
    window.addEventListener('keydown', escHandler, true);
  }

  if (btnBindPrevMouse) btnBindPrevMouse.addEventListener('click', function () { bindMouseCapture(btnBindPrevMouse, 'prev'); });
  if (btnBindNextMouse) btnBindNextMouse.addEventListener('click', function () { bindMouseCapture(btnBindNextMouse, 'next'); });
  if (btnResetMouseKeys) {
    btnResetMouseKeys.addEventListener('click', function () {
      customPrevMouseBtn = 3;
      customNextMouseBtn = 4;
      try { localStorage.removeItem(KEY_MOUSE_PREV_BTN); localStorage.removeItem(KEY_MOUSE_NEXT_BTN); } catch (err) {}
      updateMouseKeyButtons();
      toast('✓ 已恢复默认鼠标侧键');
    });
  }
  if (mouseSideSwitch) {
    mouseSideSwitch.addEventListener('click', function () {
      mouseSideEnabled = !mouseSideEnabled;
      try { localStorage.setItem(KEY_MOUSE_SIDE_ENABLED, mouseSideEnabled ? '1' : '0'); } catch (err) {}
      mouseSideSwitch.classList.toggle('on', mouseSideEnabled);
      toast(mouseSideEnabled ? '✓ 已启用鼠标侧键切换图片' : '已关闭鼠标侧键切换图片');
    });
  }
  if (mouseClickNavSwitch) {
    mouseClickNavSwitch.addEventListener('click', function () {
      mouseClickNavEnabled = !mouseClickNavEnabled;
      try { localStorage.setItem(KEY_MOUSE_CLICK_NAV_ENABLED, mouseClickNavEnabled ? '1' : '0'); } catch (err) {}
      mouseClickNavSwitch.classList.toggle('on', mouseClickNavEnabled);
      toast(mouseClickNavEnabled ? '✓ 已启用图片区域点击切换（左键=下一张/右键=上一张）' : '已关闭图片区域点击切换');
    });
  }

  window.addEventListener('mousedown', function (e) {
    if (!mouseSideEnabled) return;
    if (e.button !== customPrevMouseBtn && e.button !== customNextMouseBtn) return;
    var isInput = (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable));
    var hasActiveModal = !!document.querySelector('.overlay.show, #settingsPanel.show');
    if (isInput || hasActiveModal) return;
    e.preventDefault();
    if (e.button === customPrevMouseBtn) {
      navPrev();
    } else if (e.button === customNextMouseBtn) {
      navNext();
    }
  }, true);
  // 部分浏览器会在 mouseup 时才触发系统级的前进/后退导航，这里一并拦截，避免误触发页面历史跳转
  window.addEventListener('mouseup', function (e) {
    if (!mouseSideEnabled) return;
    if (e.button === customPrevMouseBtn || e.button === customNextMouseBtn) {
      e.preventDefault();
    }
  }, true);

  window.addEventListener('keydown', function (e) {
    var isInput = (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable));
    var hasActiveModal = !!document.querySelector('.overlay.show, #settingsPanel.show');

    if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput && !hasActiveModal) {
      if (selectedIndex >= 0) {
        e.preventDefault();
        deleteSelectedBox();
      }
    }
else if (((e.key.toLowerCase() === customSaveKey) && !isInput && !hasActiveModal && !e.ctrlKey && !e.altKey && !e.metaKey) ||
               (e.altKey && !hasActiveModal && (e.key === 's' || e.key === 'S')))
	{
      e.preventDefault();
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
        document.activeElement.blur();
                }
      saveBothFolders();
    } else if (e.ctrlKey && (e.key === 'z' || e.key === 'Z') && !isInput && !hasActiveModal) {
      e.preventDefault();
      undoLastAction();
    } else if ((e.key === 'ArrowLeft' || (e.key.toLowerCase() === customPrevKey && !e.ctrlKey && !e.altKey && !e.metaKey)) && !isInput && !hasActiveModal) {
      e.preventDefault();
      navPrev();
    } else if ((e.key === 'ArrowRight' || (e.key.toLowerCase() === customNextKey && !e.ctrlKey && !e.altKey && !e.metaKey)) && !isInput && !hasActiveModal) {
      e.preventDefault();
      navNext();
    } else if ((e.key === 'c' || e.key === 'C') && !isInput && !hasActiveModal && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      scrollToLastViewedPhoto();
    }
  });

  btnSettings.addEventListener('click', function () { toggleSettings39(); });
  var themeSelectEl=$('themeSelect');if(themeSelectEl)themeSelectEl.addEventListener('change',function(){colorTheme=this.value;try{localStorage.setItem('xunjian_color_theme',colorTheme);}catch(e){toast('主题已应用，但浏览器无法保存设置');}applyTheme();});
  themeSwitch.addEventListener('click', function () {
    theme = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY_THEME, theme); } catch (e) {}
    applyTheme();
  });
  btnResetDefects.addEventListener('click', function () {
    showConfirmDialog('重置缺陷分类', '确定要重置所有缺陷分类与标签为系统默认值吗？此操作将清除自定义分类。').then(function (ok) {
      if (!ok) return;
      defectDict = JSON.parse(JSON.stringify(DEFAULT_DEFECT_DICT));
      locationAdjacency = JSON.parse(JSON.stringify(DEFAULT_LOCATION_ADJACENCY));
      criticalDefects = new Set(CRITICAL_DEFECTS);
      candidatePool = getDefaultCandidatePool();
      hiddenDefects = {};
      saveDefectDict();
      saveCriticalDefects();
      saveAdjacency();
      saveCandidatePool();
      saveHidden();
      renderSide();
      toast('✓ 缺陷分类、危急属性与推荐规则已重置为默认');
    });
  });

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      recomputeViewerStage();
    }, 120);
  });

  /* ================= 首次提示 ================= */

  function initNotice() {
    var noPrompt = false;
    try { noPrompt = localStorage.getItem(KEY_NO_PROMPT) === '1'; } catch (e) {}
    if (noPrompt) return;
    var notice = $('notice');
    notice.classList.add('show');
    function close() {
      notice.classList.remove('show');
      if ($('noPromptCheck').checked) { try { localStorage.setItem(KEY_NO_PROMPT, '1'); } catch (e) {} }
      $('noticeClose').onclick = null; notice.onclick = null;
    }
    $('noticeClose').onclick = close;
    notice.onclick = function (e) { if (e.target === notice) close(); };
  }

  // i35: identities, exact output ownership, recoverable saves and explicit review state.
  var projectId = '', photoPaths = {}, ioBusy = false, reviewData = {}, savingPhoto46=null;
  var INDEX_FILE = '.xunjian-output-v1.json';
  var DIR_BOX = '缺陷圈示图', DIR_ORIG = '缺陷原图', DIR_CRIT = '危急缺陷';
  function uid() { return crypto.randomUUID(); }
  function displayName(id) { var f = state.byName.get(id); return f ? f.name : String(id || ''); }
  function readLocal(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch(e) { return fallback; } }
  function putLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch(e) { toast('未能保存本地记录，请勿关闭页面：' + e.message, 6000); return false; }
  }
  async function directoryId(handle) {
    async function resolve() {
      var roots = await getDirHandle('identity_roots_v1') || [];
      for (var row of roots) {
        try { if (await handle.isSameEntry(row.handle)) return row.id; } catch(e) {}
      }
      var id = uid(); roots.push({id:id, handle:handle});
      if (!await saveDirHandle('identity_roots_v1', roots)) throw new Error('无法保存目录身份，请检查应用数据目录权限后重试');
      return id;
    }
    return navigator.locks ? navigator.locks.request('xunjian-directory-identities', resolve) : resolve();
  }
  // Large metadata is stored as independent IndexedDB records, never a localStorage JSON table.
  function yield46(){return new Promise(function(resolve){setTimeout(resolve,0);});}
  async function recordBatch46(namespace, rows) {
    if(!rows.length)return;
    var db=await openDirDB();if(!db)throw new Error('无法访问本地数据库，请检查应用数据目录权限');
    try {await new Promise(function(resolve,reject){
      var tx=db.transaction('photo_records_v46','readwrite'),store=tx.objectStore('photo_records_v46');
      tx.oncomplete=resolve;tx.onabort=tx.onerror=function(){reject(tx.error||new Error('记录保存失败'));};
      try{rows.forEach(function(row){var key=[namespace,row[0]];if(row[1]===undefined)store.delete(key);else store.put(row[1],key);});}
      catch(e){tx.abort();reject(e);}
    });}finally{db.close();}
  }
  async function readRecords46(namespace) {
    var db=await openDirDB();if(!db)throw new Error('无法访问本地数据库');
    var result=Object.create(null),after=null;
    try{
      // Read bounded pages; do not retain a second full array of all records.
      while(true){
        var page=await new Promise(function(resolve,reject){
          var tx=db.transaction('photo_records_v46','readonly'),store=tx.objectStore('photo_records_v46');
          var range=IDBKeyRange.bound(after||[namespace],[namespace,[]],!!after,true);
          var keys=store.getAllKeys(range,500),values=store.getAll(range,500);
          tx.oncomplete=function(){resolve(keys.result.map(function(key,i){return [key,values.result[i]];}));};
          tx.onabort=tx.onerror=function(){reject(tx.error||new Error('记录读取失败'));};
        });
        page.forEach(function(r){result[r[0][1]]=r[1];});
        if(page.length<500)break;after=page[page.length-1][0];await yield46();
      }
      return result;
    }finally{db.close();}
  }
  async function migrateRecords46(namespace, legacyKey) {
    var current=await readRecords46(namespace),raw=localStorage.getItem(legacyKey);
    if(raw!==null){
      var old=JSON.parse(raw);if(!old||typeof old!=='object'||Array.isArray(old))throw new Error('旧记录格式异常，已保留原数据：'+legacyKey);
      var keys=Object.keys(old),batch=[];
      for(var key of keys){if(!Object.prototype.hasOwnProperty.call(current,key)){current[key]=old[key];batch.push([key,old[key]]);}
        if(batch.length===500){await recordBatch46(namespace,batch);batch=[];await yield46();}}
      await recordBatch46(namespace,batch);
      // Only discard the legacy table after every IndexedDB transaction has committed.
      localStorage.removeItem(legacyKey);
    }
    return current;
  }
  var recordPending46=0,recordFailures46=new Map();
  function queueRecord46(namespace,id,value){
    recordPending46++;
    var key=JSON.stringify([namespace,id]);
    return recordBatch46(namespace,[[id,value]]).then(function(){recordFailures46.delete(key);},function(e){
      recordFailures46.set(key,{namespace:namespace,id:id,value:value});
      toast('本地记录保存失败，请保持页面打开并重试：'+e.message,7000);
    }).finally(function(){recordPending46--;});
  }
  async function assignPhotoIdentities(entries, handle) {
    var nextProject=handle?await directoryId(handle):uid();
    var paths=await migrateRecords46('paths:'+nextProject,'xunjian_paths_'+nextProject),batch=[];
    for(var i=0;i<entries.length;i++){
      var f=entries[i],path=f.relPath||f.name;
      if(!Object.prototype.hasOwnProperty.call(paths,path)){paths[path]=nextProject+':'+uid();batch.push([path,paths[path]]);}
      f.id=paths[path];
      if(batch.length===500){await recordBatch46('paths:'+nextProject,batch);batch=[];await yield46();}
    }
    await recordBatch46('paths:'+nextProject,batch);
    var reviews=await migrateRecords46('review:'+nextProject,'xunjian_review_'+nextProject);
    projectId=nextProject;photoPaths=paths;reviewData=reviews;
  }
  async function persistPhotoPaths() {
    var next=Object.create(null),changes=[];
    state.files.forEach(function(f){var path=f.relPath||f.name;next[path]=f.id;if(photoPaths[path]!==f.id)changes.push([path,f.id]);});
    Object.keys(photoPaths).forEach(function(path){if(!Object.prototype.hasOwnProperty.call(next,path))changes.push([path,undefined]);});
    FastIndex.invalidate();VirtualTree48.invalidate();
    // A rename and its old-path deletion commit together.
    await recordBatch46('paths:'+projectId,changes);photoPaths=next;
  }
  function reviewOf(id) { return reviewData[id] || {status:'pending', decision:'auto'}; }
  function setReview(id, patch) {
    FastIndex.ensure();var oldReviewStatus=reviewOf(id).status;
    reviewData[id] = Object.assign({}, reviewOf(id), patch);
    FastIndex.reviewChanged(oldReviewStatus,reviewOf(id).status);
    queueRecord46('review:'+projectId,id,reviewData[id]);
    updateReviewUI();
  }
  function effectiveCritical(id) {
    var d = reviewOf(id).decision;
    if (d === 'critical') return true;
    if (d === 'normal') return false;
    return getMeta(id).appended.some(function(t) { return isCriticalDefectTag(t); });
  }
  // updateReviewUI: i38 performance implementation below.

  $('reviewStatus').addEventListener('change', function(e) {
    var id = curName(); if(!id||editLocked48())return;
    if ((e.target.value === 'clear' || e.target.value === 'defect') && !currentImage()) {
      toast('图片尚未成功显示，请先加载或标为需复核/不可用'); updateReviewUI(); return;
    }
    setReview(id, {status:e.target.value}); renderPathTree(false);
  });
  $('criticalDecision').addEventListener('change', function(e) {
    if(!curName()||editLocked48())return;
    setReview(curName(), {decision:e.target.value}); renderSide();
  });
  // Stop overlapping disk operations and edits while a snapshot is being saved.
  async function withIO(job,allowQueue48) {
    if(ioBusy||state.navBusy||(!allowQueue48&&saveQueueBusy48())){toast('请等待当前保存任务完成');return;}
    ioBusy = true; document.body.classList.add('io-busy'); updateReviewUI();
    try { if(outputScanTask46)await outputScanTask46; return await job(); }
    catch(e) { toast('操作未完成：' + (savingPhoto46?displayName(savingPhoto46)+'：':'') + (e.message || e), 7000); console.error(e); }
    finally{ioBusy=false;document.body.classList.remove('io-busy');if(!state.navBusy)loadingEl.style.display='none';updateReviewUI();SaveQueue48.paint();SaveQueue48.pump();pumpDecode();}

  }
  document.addEventListener('click', function(e) {
    if(!ioBusy&&!photoPending48(curName()))return;
    if((savingPhoto46||photoPending48(curName())) && (e.target.closest('#btnPrev, #btnNext') || (e.target.closest('#pathTree .loc-item') && !e.target.closest('button,select,input'))))return;
    if (e.target.closest('#confirmModal, #promptModal')) return;
    // Existing confirmation dialogs use these buttons; never block them.
    if (e.target.closest('.modal-overlay, .confirm-overlay, .prompt-overlay')) return;
    if (e.target.closest('#pathTree, #sideScroll, #viewerBottomBar, #btnFolder, #btnOutput, #moreToolsMenu, #preview')) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('keydown', function(e) {
    if((!ioBusy&&!photoPending48(curName()))||e.target.closest('input,textarea,select'))return;
    if((savingPhoto46||photoPending48(curName()))&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&['ArrowLeft','ArrowRight',customPrevKey,customNextKey].includes(e.key.length===1?e.key.toLowerCase():e.key))return;
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'Tab') return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  function emptyIndex() { return {version:1, revision:0, records:[], garbage:[]}; }
  function validArtifact(r) {
    return r && typeof r.photoId === 'string' && ['normal','auto','manual','legacy'].includes(r.kind) &&
      [DIR_BOX,DIR_ORIG,DIR_CRIT].includes(r.dir) && typeof r.path === 'string' &&
      r.path.split('/').every(function(p) { return p && p !== '.' && p !== '..' && !p.includes('\\'); });
  }
  async function rawReadOutputIndex42(root) {
    try {
      var h = await root.getFileHandle(INDEX_FILE);
      var doc = JSON.parse(await (await h.getFile()).text());
      if (doc.version !== 1 || !Array.isArray(doc.records) || !Array.isArray(doc.garbage) || !doc.records.every(validArtifact) || !doc.garbage.every(validArtifact))
        throw new Error('输出索引格式异常，已停止操作以保护现有成果');
      return doc;
    } catch(e) { if (e.name === 'NotFoundError') return emptyIndex(); throw e; }
  }
  async function artifactParent(root, r, create) {
    var d = root.name === r.dir ? root : await root.getDirectoryHandle(r.dir, {create:!!create});
    var parts = r.path.split('/');
    for (var i=0; i<parts.length-1; i++) d = await d.getDirectoryHandle(parts[i], {create:!!create});
    return {dir:d, name:parts[parts.length-1]};
  }
  async function artifactHandle(root, r) {
    var p = await artifactParent(root,r,false); return p.dir.getFileHandle(p.name);
  }
  async function writeBlob(h, blob) {
    var w = await h.createWritable();
    try { await w.write(blob); await w.close(); }
    catch(e) { try { await w.abort(); } catch(_) {} throw e; }
    if ((await h.getFile()).size !== blob.size) throw new Error('文件写入校验失败');
  }
  async function writeOutputIndex(root, doc) {
    var h = await root.getFileHandle(INDEX_FILE,{create:true});
    await writeBlob(h, new Blob([JSON.stringify(doc)], {type:'application/json'}));
  }
  // Older outputs are associated only when there is exactly one possible input.
  // Ambiguous names and incomplete new revisions are never guessed or deleted.
  function matchLegacy(name) {
    if (name.includes('__xj_')) return null;
    var ext = name.slice(name.lastIndexOf('.')).toLowerCase(), base = name.slice(0,name.lastIndexOf('.'));
    var exact = state.files.filter(function(f) { return f.name.toLowerCase() === name.toLowerCase(); });
    if (exact.length) return exact.length === 1 ? exact[0] : null;
    var matches = state.files.filter(function(f) {
      var e=f.name.slice(f.name.lastIndexOf('.')).toLowerCase(), b=f.name.slice(0,f.name.lastIndexOf('.'));
      return e===ext && base.startsWith(b+'_');
    });
    return matches.length === 1 ? matches[0] : null;
  }
  function outputKey51(dir,path){return dir+'/'+path;}
  function normOutput51(s){return String(s||'').normalize('NFC').replace(/\\/g,'/').toLocaleLowerCase();}
  function outputMatcher51(){
    var paths=new Map(),stems=new Map();
    function add(map,key,f){if(!map.has(key))map.set(key,[]);map.get(key).push(f);}
    for(var f of state.files){add(paths,normOutput51(f.relPath||f.name),f);add(stems,normOutput51(f.name.replace(/\.[^.]+$/,'')),f);}
    return function(entry,record){
      if(record&&state.byName.has(record.photoId))return state.byName.get(record.photoId);
      if(record&&record.relPath){var exact=paths.get(normOutput51(record.relPath));if(exact&&exact.length===1)return exact[0];if(exact&&exact.length>1)return null;}
      var base=normOutput51(cleanName42(entry.path.split('/').pop()).replace(/\.[^.]+$/,''));
      // Match a complete original basename. Longest prefix wins; no fuzzy pole matching.
      var ends=[base.length];for(var i=base.length-1;i>=0;i--)if(base[i]==='_')ends.push(i);
      for(var end of ends){var candidates=stems.get(base.slice(0,end));if(!candidates)continue;
        if(candidates.length===1)return candidates[0];
        // When outputs preserve source subfolders, use the complete relative directory.
        var folder=normOutput51(entry.path.slice(0,entry.path.lastIndexOf('/')+1)).replace(/^(全绝缘缺陷|其他缺陷|其它缺陷)\//,'');
        var same=candidates.filter(function(f){var p=normOutput51(f.relPath||f.name);return p.slice(0,p.lastIndexOf('/')+1)===folder;});
        return same.length===1?same[0]:null;
      }
      return null;
    };
  }
  async function reconcileOutputs51(root,doc){
    var files=await inventory42(root,[DIR_BOX,DIR_ORIG,DIR_CRIT]),match=outputMatcher51(),byPath=new Map(),garbage=new Set(doc.garbage.map(function(r){return outputKey51(r.dir,r.path);}));
    doc.records.forEach(function(r){var key=outputKey51(r.dir,r.path);if(!byPath.has(key))byPath.set(key,[]);byPath.get(key).push(r);});
    var replacements=new Map(),found=[],unmatched=0;
    for(var i=0;i<files.length;i++){
      var entry=files[i],key=outputKey51(entry.dir,entry.path);if(garbage.has(key))continue;
      var owners=byPath.get(key)||[],matches=owners.length?owners.map(function(r){return match(entry,r);}):[match(entry,null)];
      var ids=new Set(matches.filter(Boolean).map(function(f){return f.id;}));
      if(ids.size!==1||matches.some(function(f){return !f;})){unmatched++;continue;}
      var f=matches[0],record=owners[0]||{};
      var linked=Object.assign({},record,{photoId:f.id,projectId:projectId,relPath:f.relPath,dir:entry.dir,path:entry.path,
        kind:record.kind||(entry.dir===DIR_CRIT?'manual':'legacy'),tag:record.tag||extractDefectTag(f.name,entry.path.split('/').pop())});
      if(!owners.length)linked.legacy=true;
      replacements.set(key,linked);found.push({record:linked,handle:entry.handle});
      if(i&&i%100===0)await yield46();
    }
    var records=[],emitted=new Set();for(var r of doc.records){var key=outputKey51(r.dir,r.path);if(replacements.has(key)){if(!emitted.has(key))records.push(replacements.get(key));emitted.add(key);}else records.push(r);}
    for(var pair of replacements)if(!emitted.has(pair[0]))records.push(pair[1]);
    return {doc:Object.assign({},doc,{records:records}),found:found,unmatched:unmatched,changed:JSON.stringify(doc.records)!==JSON.stringify(records)};
  }
  var legacyCache46=new WeakMap();
  async function legacyRecords(root, doc, reuse) {
    var cached=legacyCache46.get(root);
    if(reuse&&cached&&cached.project===projectId&&cached.revision===doc.revision){var known=new Set(doc.records.concat(doc.garbage).map(function(r){return r.dir+'/'+r.path;}));return cached.rows.filter(function(r){return !known.has(r.dir+'/'+r.path);});}
    var result = [], owned = new Set(doc.records.concat(doc.garbage).map(function(r) {return r.dir+'/'+r.path;}));
    for (var dirName of [DIR_BOX,DIR_ORIG,DIR_CRIT]) {
      var d;
      try { d = root.name === dirName ? root : await root.getDirectoryHandle(dirName); }
      catch(e) { if (e.name === 'NotFoundError') continue; throw e; }
      async function walk(h, prefix) {
        for await (var entry of h.values()) {
          if (entry.name.startsWith('.')) continue;
          var path=prefix+entry.name;
          if (entry.kind==='directory') { await walk(entry,path+'/'); continue; }
          if (owned.has(dirName+'/'+path)) continue;
          var f=matchLegacy(entry.name);
          if (f) result.push({photoId:f.id, projectId:projectId, relPath:f.relPath, dir:dirName, path:path,
            kind:dirName===DIR_CRIT?'manual':'legacy', tag:extractDefectTag(f.name,entry.name), legacy:true});
        }
      }
      await walk(d,'');
    }
    legacyCache46.set(root,{project:projectId,revision:doc.revision,rows:result});
    return result;
  }
  async function outputLock(root, job) {
    var id=await directoryId(root);
    var run=async function(){if(window.DesktopFS)await DesktopFS.call('recover-output',{h:root});else await recover42(root);return job();};
    return navigator.locks ? navigator.locks.request('xunjian-output-'+id,run) : run();
  }
  async function cleanGarbage(root, doc) {
    if(!doc.garbage.length)return 0;
    var left=[];
    for (var r of doc.garbage) {
      if (doc.records.some(function(x) {return x.dir===r.dir && x.path===r.path;})) continue;
      try { var p=await artifactParent(root,r,false); await p.dir.removeEntry(p.name); }
      catch(e) { if(e.name!=='NotFoundError') left.push(r); }
    }
    // Compact the cleanup list so repeated saves do not accumulate filesystem scans.
    doc.garbage=left;
    try {await writeOutputIndex(root,doc);} catch(e) {toast('新成果已提交，清理记录更新失败；下次操作会重新核对',6000);}
    if(left.length) toast('成果已提交；'+left.length+' 个旧文件未能清理，下次操作会重试',6500);
    return left.length;
  }
  async function commitArtifacts(f, additions, removeWhen, direct46, beforeWrite) {
    var root=output.mainHandle;
    return outputLock(root,async function() {
      var doc=await rawReadOutputIndex42(root);
      doc.records=doc.records.concat(await legacyRecords(root,doc,true));
      var obsolete=doc.records.filter(function(r) {return r.photoId===f.id && removeWhen(r);});
      var legacyObsolete=obsolete.filter(function(r){return r.legacy;});
      if(legacyObsolete.length && !await showConfirmDialog('确认旧版文件归属',
        '以下旧版文件按唯一文件名匹配到 '+f.relPath+'，请核对后确认替换/撤回：\n'+
        legacyObsolete.map(function(r){return r.dir+'/'+r.path;}).join('\n'))) throw new Error('已取消，旧版文件保持原样');
      // Use ordinary names. Only real collisions need a readable number.
      var desired=additions.map(function(a){return a.path;});
      var prepared=[],number=1;
      while(true) {
        prepared=[];var collision=false;
        for(var i=0;i<additions.length;i++) {
          var a=additions[i],path=desired[i];
          if(number>1){var dot=path.lastIndexOf('.');path=path.slice(0,dot)+'（'+number+'）'+path.slice(dot);}
          var candidate=Object.assign({},a,{path:path});
          var owners=doc.records.filter(function(r){return r.dir===a.dir && r.path===path;});
          var reusable=owners.length>0 && owners.every(function(r){return obsolete.includes(r);});
          var p=await artifactParent(root,candidate,true),handle=null;
          try{handle=await p.dir.getFileHandle(p.name);}catch(e){if(e.name!=='NotFoundError')throw e;}
          if((owners.length && !reusable) || (handle && !reusable) || prepared.some(function(x){return x.a.dir===a.dir && x.a.path===path;})) {collision=true;break;}
          prepared.push({a:candidate,p:p,handle:handle});
        }
        if(!collision)break;
        if(++number>10000)throw new Error('同名文件过多，请整理输出目录后重试');
      }
      additions=prepared.map(function(x){return x.a;});
      if(beforeWrite)await beforeWrite(additions);
      var next={version:1,revision:doc.revision+1,records:doc.records.filter(function(r){return !obsolete.includes(r);})
        .concat(additions.map(function(a){var r=Object.assign({},a);delete r.blob;return r;})),garbage:doc.garbage.concat(obsolete)};
      var changes=additions.map(function(a){return {path:a.dir+'/'+a.path,blob:a.blob};});
      changes.push(indexChange42(next));await transaction42(root,changes,!!direct46);
      await cleanGarbage(root,next);
      legacyCache46.set(root,{project:projectId,revision:next.revision,rows:[]});
      return next;
    });
  }
  async function deleteExistingDefectOutputs(id, onlyDirs, groupKey) {
    var f=state.byName.get(id);if(!f||!output.mainHandle)return 0;
    var root=output.mainHandle,dirs=onlyDirs||[DIR_BOX,DIR_ORIG,DIR_CRIT];
    return outputLock(root,async function(){
      var raw=await rawReadOutputIndex42(root),linked=await reconcileOutputs51(root,raw),doc=linked.doc;
      var targets=new Map();
      for(var r of doc.records.concat(doc.garbage)){
        if(r.photoId!==id||!dirs.includes(r.dir)||(groupKey&&outputGroupKey52(r)!==groupKey))continue;
        if(doc.records.some(function(other){return other.dir===r.dir&&other.path===r.path&&other.photoId!==id;}))throw new Error('有文件对应多张照片，已停止撤回，未删除任何图片');
        try{await artifactHandle(root,r);targets.set(outputKey51(r.dir,r.path),r);}catch(e){if(e.name!=='NotFoundError')throw e;}
      }
      // Every deletion and the index update share one journal. Failure restores all three folders.
      var remove=function(r){return r.photoId===id&&dirs.includes(r.dir)&&(!groupKey||outputGroupKey52(r)===groupKey);};
      var next={version:1,revision:doc.revision+1,records:doc.records.filter(function(r){return !remove(r);}),garbage:doc.garbage.filter(function(r){return !remove(r);})};
      var changes=Array.from(targets.keys()).map(function(p){return {path:p,blob:null};});changes.push(indexChange42(next));
      if(window.DesktopFS&&targets.size){await DesktopFS.call('trash-delete',{h:root,paths:Array.from(targets.keys()),records:doc.records.filter(function(r){return remove(r)&&targets.has(outputKey51(r.dir,r.path));}),expectedIndex:raw,nextIndex:next,label:displayName(id)});}
      else await transaction42(root,changes);legacyCache46.delete(root);
      return targets.size;
    });
  }
  async function scanCriticalDirectory() {
    var set=new Set(); if(!output.mainHandle) return set;
    var doc=await readOutputIndex(output.mainHandle);
    var rows=doc.records.concat(await legacyRecords(output.mainHandle,doc));
    for(var r of rows) if(r.dir===DIR_CRIT && state.byName.has(r.photoId)) {
      try {await artifactHandle(output.mainHandle,r);set.add(r.photoId);} catch(e) {if(e.name!=='NotFoundError') throw e;}
    }
    return set;
  }
  var outputScanTask46=null;
  async function scanOutputDirectory(options){
    if(outputScanTask46)return outputScanTask46;
    var task=scanOutputDirectoryImpl46(options||{});outputScanTask46=task;
    try{return await task;}finally{if(outputScanTask46===task)outputScanTask46=null;}
  }
  async function scanOutputDirectoryImpl46(options) {
    if(!output.mainHandle||!state.files.length)return;
    try {
      var root=output.mainHandle,generation=projectId;
      var linked=await outputLock(root,async function(){
        var raw=await rawReadOutputIndex42(root),linked=await reconcileOutputs51(root,raw);
        if(projectId!==generation||output.mainHandle!==root)return null;
        if(linked.changed){linked.doc.revision++;await transaction42(root,[indexChange42(linked.doc)]);legacyCache46.delete(root);}
        return linked;
      });
      if(!linked||projectId!==generation||output.mainHandle!==root)return;
      var marked=new Set(),handles=new Map(),tags=new Map(),counts=new Map(),critical=new Set(),groups=new Map(),handlePriority=new Map(),handleRank=new Map(),recordRank=new Map(linked.doc.records.map(function(r,i){return [outputKey51(r.dir,r.path),i];}));
      for(var item of linked.found){var r=item.record,id=r.photoId;marked.add(id);
        if(r.dir===DIR_CRIT)critical.add(id);
        var priority=r.dir===DIR_BOX?2:r.dir===DIR_CRIT?1:0;
        var rank=recordRank.get(outputKey51(r.dir,r.path))||0;if(priority>0&&(priority>(handlePriority.get(id)||0)||(priority===(handlePriority.get(id)||0)&&rank>(handleRank.get(id)||0)))){handles.set(id,item.handle);handlePriority.set(id,priority);handleRank.set(id,rank);}
        if(r.tag)tags.set(id,r.tag);
        if(!groups.has(id))groups.set(id,new Set());groups.get(id).add(r.pairId||normOutput51(r.path.split('/').pop()));
      }
      groups.forEach(function(g,id){counts.set(id,g.size);});
      await viewedReady48;if(!await flushViewed48())throw new Error('已看记录保存失败，请重试');
      var seen=Array.from(marked).filter(function(id){return !viewedPhotosMap[id];}).map(function(id){return [id,true];});
      if(seen.length)await recordBatch46('viewed:global',seen);
      seen.forEach(function(r){viewedPhotosMap[r[0]]=true;});
      for(var pair of state.cache){var id=pair[0],c=pair[1];if(c.isBoxed&&(!handles.has(id)||!state.markedBoxedHandles.has(id)||!await handles.get(id).isSameEntry(state.markedBoxedHandles.get(id))))dropImage(id);}
      state.markedFiles=marked;state.markedBoxedHandles=handles;state.markedDefectTags=tags;state.markedCounts=counts;state.criticalFiles=critical;
      FastIndex.invalidate();renderPathTree(false);updateHud();
      if(state.index>=0&&!ioBusy&&!options.noReselect)await switchTo(state.index,true);
      if(!options.quiet)toast('已从输出目录同步 '+marked.size+' 张照片的已看、已标记状态'+(linked.unmatched?'；'+linked.unmatched+' 个文件无法唯一对应，已保留':'')+(seen.length?'（新增已看 '+seen.length+' 张）':''),6500);
      return {marked:marked.size,viewedAdded:seen.length,unmatched:linked.unmatched};
    }catch(e){toast('同步未完成：'+e.message,6000);throw e;}
  }
  async function applySavedPhoto46(root,doc,id){
    var rows=doc.records.filter(function(r){return r.photoId===id;}),boxes=rows.filter(function(r){return r.dir===DIR_BOX;}),handle=null;
    if(boxes.length)handle=await artifactHandle(root,boxes[boxes.length-1]);
    FastIndex.ensure();var oldCount=state.markedCounts.get(id)||0;
    if(handle){state.markedFiles.add(id);state.markedBoxedHandles.set(id,handle);state.markedCounts.set(id,boxes.length);state.markedDefectTags.set(id,boxes[boxes.length-1].tag||'');}
    else{state.markedFiles.delete(id);state.markedBoxedHandles.delete(id);state.markedCounts.delete(id);state.markedDefectTags.delete(id);}
    if(rows.some(function(r){return r.dir===DIR_CRIT;}))state.criticalFiles.add(id);else state.criticalFiles.delete(id);
    FastIndex.markedChanged(state.indexByName.get(id),oldCount,boxes.length);
    if(handle)updateTreeAfterSave(id,state.markedDefectTags.get(id));else refreshTreeStats();
  }
  function makeArtifact(f,dir,kind,blob,tag,frozenName46) {
    var nv=frozenName46||newNamePreview(), ext=nv.ext;
    // Canvas supports PNG/JPEG; keep suffix consistent when a BMP/WebP/TIFF is annotated.
    if(blob.type==='image/jpeg' && !/\.jpe?g$/i.test(ext)) ext='.jpg';
    if(blob.type==='image/png') ext='.png';
    var base=(nv.base+tag).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_');
    // Bound filename length, leaving room for a readable collision number.
    while(new TextEncoder().encode(base).length>160) base=base.slice(0,-1);
    return {photoId:f.id,projectId:projectId,relPath:f.relPath,dir:dir,kind:kind,
      path:base+ext,tag:tag,blob:blob};
  }
  function saveQueueBusy48(){return !!(SaveQueue48&&SaveQueue48.busy());}
  function photoPending48(id){return !!(SaveQueue48&&SaveQueue48.has(id));}
  function editLocked48(){return ioBusy||state.navBusy||photoPending48(curName());}
  var SaveQueue48=(function(){
    var jobs=[],active=null,sequence=0,completed=0,limit=4,byteLimit=96*1024*1024;
    function pending(){return jobs.filter(function(j){return j.status==='waiting'||j.status==='working';});}
    function has(id){return pending().some(function(j){return j.id===id;});}
    function busy(){return !!active||pending().length>0;}
    function paint(){
      var waiting=pending(),failures=jobs.filter(function(j){return j.status==='failed';}),current=curName();
      var title=$('saveStatus48'),badge=$('queueCount48'),button=$('btnBottomSave');
      var message=active?active.phase+' · '+active.name:failures.length?failures.length+' 项保存失败，点击重试':completed?'已保存 '+completed+' 次':'保存任务';
      if(title&&title.textContent!==message)title.textContent=message;
      if(badge)badge.textContent=waiting.length?'待完成 '+waiting.length:failures.length?'需处理 '+failures.length:'就绪';
      if(button){button.disabled=!!current&&has(current);button.textContent=has(current)?'本图正在保存…':'保存缺陷图片';}
      var list=$('saveJobs48');if(list&&$('queuePanel48').open){
        list.innerHTML=jobs.slice(-8).reverse().map(function(j){
          var status=j.status==='failed'?'保存失败':j.status==='done'?'已保存':j.status==='waiting'?'排队中':j.phase;
          return '<li><div><strong>'+esc(j.name)+'</strong><span>'+esc(status)+(j.error?'：'+esc(j.error):'')+'</span></div>'+(j.status==='failed'?'<button type="button" class="btn" data-retry48="'+j.key+'">重试</button><button type="button" class="btn" data-dismiss48="'+j.key+'">移除任务</button>':'')+'</li>';
        }).join('')||'<li>保存后的状态会显示在这里。</li>';
      }
      var retry=$('retryRecords48');if(retry)retry.hidden=!viewedError48&&!recordFailures46.size;
    }
    function admit(job){
      if(has(job.id)){toast('这张照片已在保存队列中');return Promise.resolve(false);}
      var obsolete=jobs.filter(function(j){return j.status==='failed'&&j.id===job.id&&j.manual===job.manual&&j.project===job.project;}),retained=jobs.filter(function(j){return j.status!=='done'&&!obsolete.includes(j);}),bytes=retained.reduce(function(n,j){return n+(j.clean?j.clean.size:0);},0);
      if(retained.length>=limit||(retained.length&&bytes+job.clean.size>byteLimit)){toast('保存队列已满，请等当前任务完成或处理失败任务',4500);return Promise.resolve(false);}
      jobs=jobs.filter(function(j){return !obsolete.includes(j);});
      job.signature=JSON.stringify([job.boxes,job.tag,job.secondary]);job.key=++sequence;job.status='waiting';jobs.push(job);
      var promise=new Promise(function(resolve){job.resolve=resolve;});paint();VirtualTree48.render(true);pump();return promise;
    }
    async function execute(job){
      if(projectId!==job.project||output.mainHandle!==job.root)throw new Error('输入或输出目录已切换，请回到原目录后重试');
      savingPhoto46=job.id;job.phase='合成圈框';paint();cancelDetails38();trimForExport46();schedulePreload(state.index,navDirection47);await yield46();
      var boxed;exportBusy47=true;
      try{boxed=await exportPhoto46(job.clean,job.mime,job.boxes,job.stroke);}finally{exportBusy47=false;detail38();}
      job.phase='写入图片';paint();var additions=[],pair=uid();
      if(job.manual)additions.push(makeArtifact(job.file,DIR_CRIT,'manual',boxed,job.tag,job.outputName));
      else{
        additions.push(makeArtifact(job.file,DIR_BOX,'normal',boxed,job.tag,job.outputName));
        additions.push(makeArtifact(job.file,DIR_ORIG,'normal',job.clean,job.tag,job.outputName));
        if(job.critical)additions.push(makeArtifact(job.file,DIR_CRIT,'auto',boxed,job.tag,job.outputName));
      }
      additions.forEach(function(a){a.pairId=pair;});
      var doc=await commitArtifacts(job.file,additions,function(r){
        if(job.manual)return r.dir===DIR_CRIT&&r.kind==='manual';
        if(job.secondary)return false;
        return r.dir===DIR_BOX||r.dir===DIR_ORIG||(r.dir===DIR_CRIT&&r.kind==='auto');
      },true);
      // Disk commit is the success boundary. A later display failure cannot turn it into an unsaved task.
      job.status='done';completed++;job.clean=null;
      recordOperation52('保存成果',job.name,'成功',additions.length);
      setReview(job.id,{status:'defect'});
      if(!job.manual){job.meta.saved=true;job.meta.isSecondaryEdit=false;}
      try{await applySavedPhoto46(job.root,doc,job.id);if(!job.manual)refreshSavedPreview47(job.id,job.boxes);}
      catch(e){toast(job.name+' 已保存，界面未完全同步，请点击刷新输出',6000);console.warn(e);}
      toast(job.manual?'✓ 危急缺陷图片保存成功':'✓ 缺陷图片保存成功',3000,'success');
      if(curName()===job.id)flashSaved(job.manual?'危急图片已保存 ✓':'缺陷成果已保存 ✓');
      renderSide();updateHud();
    }
    async function pump(){
      if(active||ioBusy)return;var job=jobs.find(function(j){return j.status==='waiting';});if(!job)return;
      active=job;job.status='working';paint();
      try{await execute(job);job.resolve(true);}
      catch(e){if(job.status==='done'){job.resolve(true);}else{job.status='failed';job.error=e.message||String(e);recordOperation52('保存成果',job.name,'失败',0,job.error);job.resolve(false);toast(job.name+' 保存失败，可在任务面板重试：'+job.error,7000,'error');$('queuePanel48').open=true;}}
      finally{
        active=null;savingPhoto46=null;exportBusy47=false;
        // Completed history retains text only, never File handles, image buffers or metadata snapshots.
        if(job.status==='done'){job.file=null;job.meta=null;job.root=null;job.boxes=[];}
        while(jobs.filter(function(j){return j.status==='done';}).length>5){var old=jobs.findIndex(function(j){return j.status==='done';});jobs.splice(old,1);}
        paint();updateReviewUI();VirtualTree48.render(true);pumpDecode();if(state.index>=0){schedulePreload(state.index,navDirection47);detail38();}pump();
      }
    }
    function retry(key){var job=jobs.find(function(j){return j.key===key&&j.status==='failed';});if(!job)return;
      if(projectId!==job.project||output.mainHandle!==job.root){toast('目录已经切换，请移除旧任务后重新保存这张照片',5000);return;}
      if(has(job.id)){toast('这张照片已有保存任务，请等待完成');return;}
      var m=state.meta.get(job.id);if(m!==job.meta||JSON.stringify([m.boxes,m.appended.join(''),!!m.isSecondaryEdit])!==job.signature){toast('这张照片已重新编辑，请保存当前内容；旧失败任务可以移除',5000);return;}
      job.status='waiting';job.error='';job.resolve=function(){};paint();pump();
    }
    function dismiss(key){var i=jobs.findIndex(function(j){return j.key===key&&j.status==='failed';});if(i>=0){jobs.splice(i,1);paint();}}
    return {enqueue:admit,busy:busy,has:has,paint:paint,pump:pump,retry:retry,dismiss:dismiss,stats:function(){return {active:!!active,pending:pending().length,failed:jobs.filter(function(j){return j.status==='failed';}).length,completed:completed};}};
  })();
  async function savePhoto(manual){
    if(!XunjianAuth.current()){toast('请先登录');return false;}
    var snapshot=await withIO(async function(){
      var id=curName(),f=state.byName.get(id);if(!f){toast('未打开任何图片');return null;}
      if(photoPending48(id)){toast('本图已在保存队列中');return null;}
      if(!await ensureOutputDir())return null;if(outputScanTask46)await outputScanTask46;
      if([DIR_BOX,DIR_ORIG,DIR_CRIT].includes(output.mainHandle.name))throw new Error('请选择三个成果子文件夹的上一级目录');
      var m=getMeta(id);newNamePreview(id);
      if((!m.boxes.length||!m.appended.length)&&!await showConfirmDialog('保存确认','当前照片尚未圈框或添加缺陷标签，确定保存吗？'))return null;
      return {id:id,file:f,name:f.name,project:projectId,root:output.mainHandle,meta:m,manual:!!manual,username:XunjianAuth.current().username,
        boxes:m.boxes.map(function(b){return Object.assign({},b);}),tag:m.appended.join(''),secondary:!!m.isSecondaryEdit,
        outputName:Object.assign({},newNamePreview(id)),critical:effectiveCritical(id),stroke:strokeWidth,mime:f.mime,clean:f.file||await f.handle.getFile()};
    },true);
    return snapshot?SaveQueue48.enqueue(snapshot):false;
  }

  async function saveBothFolders() { return savePhoto(false); }
  async function saveCriticalOnly() { return savePhoto(true); }
  async function createOriginalPhotosFromBoxed() {
    return withIO(async function(){
      if(!await ensureOutputDir())return;
      var doc=await readOutputIndex(output.mainHandle),rows=doc.records.concat(await legacyRecords(output.mainHandle,doc)),count=0;
      for(var r of rows){
        if(r.dir!==DIR_BOX||!state.byName.has(r.photoId))continue;
        var candidates=rows.filter(function(x){return x.dir===DIR_ORIG&&x.photoId===r.photoId&&((r.pairId&&x.pairId===r.pairId)||x.path===r.path);});
        var exists=false;for(var x of candidates){try{await artifactHandle(output.mainHandle,x);exists=true;break;}catch(e){if(e.name!=='NotFoundError')throw e;}}
        if(exists)continue;
        var f=state.byName.get(r.photoId),pairId=r.pairId||uid();
        var box=Object.assign({},r,{pairId:pairId,blob:await (await artifactHandle(output.mainHandle,r)).getFile()});
        var orig=Object.assign({},r,{dir:DIR_ORIG,pairId:pairId,blob:f.file||await f.handle.getFile()});
        await commitArtifacts(f,[box,orig],function(x){return (x.dir===DIR_BOX&&x.path===r.path)||(x.dir===DIR_ORIG&&x.path===r.path);});count++;
      }
      await scanOutputDirectory();toast('已补全 '+count+' 张原图，圈示图与原图名称保持对应');
    });
  }
  // Copy the whole directory before removing the source, and reject target collisions.
  async function copyAndRemoveDirectoryContents(src,dst) {
    for await(var pair of src.entries()) {
      var name=pair[0],h=pair[1];
      if(h.kind==='directory') await copyAndRemoveDirectoryContents(h,await dst.getDirectoryHandle(name,{create:true}));
      else await writeBlob(await dst.getFileHandle(name,{create:true}),await h.getFile());
    }
  }
  async function renameDirectoryOnDisk(info,oldName,newName) {
    if(!info || !info.parentHandle) return {success:false,reason:'no_parent'};
    try {
      var exists=false;
      try {await info.parentHandle.getDirectoryHandle(newName);exists=true;}catch(e){if(e.name!=='NotFoundError')throw e;}
      if(exists) throw new Error('目标文件夹已存在，不能合并覆盖');
      var dest=await info.parentHandle.getDirectoryHandle(newName,{create:true});
      await copyAndRemoveDirectoryContents(info.handle,dest);
      await info.parentHandle.removeEntry(oldName,{recursive:true});
      return {success:true,method:'copy_verified',newHandle:dest};
    } catch(e) {toast('目录重命名未完成：'+e.message,6000);return {success:false,reason:e.message};}
  }
  async function refreshInputHandles() {
    for(var f of state.files) {
      var parts=(f.relPath||f.name).split('/'),d=lastInputHandle;
      for(var i=0;i<parts.length-1;i++) d=await d.getDirectoryHandle(parts[i]);
      f.handle=await d.getFileHandle(parts[parts.length-1]);
    }
    // Rebuild nested parent handles after copy-and-remove directory renames.
    for(var pair of dirRegistry) {
      var parts=pair[0].split('/').filter(Boolean),d=lastInputHandle,parent=null;
      try {for(var part of parts){parent=d;d=await d.getDirectoryHandle(part);} pair[1].handle=d;pair[1].parentHandle=parent;}
      catch(e) {}
    }
  }
  async function checkAndCleanOutputDefectNames() {
    return withIO(async function() {
      if(!await ensureOutputDir())return;
      var doc=await readOutputIndex(output.mainHandle),rows=doc.records.concat(await legacyRecords(output.mainHandle,doc));
      var groups=new Map(),count=0,skipped=0;
      for(var r of rows) {
        if(!state.byName.has(r.photoId)){skipped++;continue;}
        var key=JSON.stringify([r.photoId,r.path]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
      }
      for(var group of groups.values()) {
        var first=group[0],leaf=first.path.split('/').pop();
        var plain=leaf.replace(/__xj_[a-f0-9-]+(?=\.[^.]+$)/i,'');
        var clean=cleanDefectFileName(plain);if(clean===leaf)continue;
        var path=first.path.slice(0,first.path.length-leaf.length)+clean,additions=[];
        for(var r of group) {
          var blob=await (await artifactHandle(output.mainHandle,r)).getFile();
          additions.push(Object.assign({},r,{path:path,blob:blob,legacy:false}));
        }
        await commitArtifacts(state.byName.get(first.photoId),additions,function(x){return x.photoId===first.photoId && x.path===first.path && group.some(function(r){return r.dir===x.dir && r.kind===x.kind;});});
        count+=group.length;
      }
      await scanOutputDirectory();toast('已规范化 '+count+' 个文件（含旧随机后缀）'+(skipped?'；'+skipped+' 个未关联当前输入目录的文件已跳过':''),6000);
    });
  }

  var JOURNAL42='.xunjian-recovery-v1';
  async function pathHandle42(root,path,create) {
    var parts=path.split('/');if(parts.some(function(p){return !p||p==='.'||p==='..'||p.includes('\\');}))throw new Error('无效的成果路径');
    var d=root;for(var i=0;i<parts.length-1;i++)d=await d.getDirectoryHandle(parts[i],{create:!!create});
    return {dir:d,name:parts[parts.length-1]};
  }
  async function fileAt42(root,path) {var p=await pathHandle42(root,path,false);return p.dir.getFileHandle(p.name);}
  async function removeAt42(root,path) {try{var p=await pathHandle42(root,path,false);await p.dir.removeEntry(p.name);}catch(e){if(e.name!=='NotFoundError')throw e;}}
  async function recover42(root) {
    var d;try{d=await root.getDirectoryHandle(JOURNAL42);}catch(e){if(e.name==='NotFoundError')return;throw e;}
    var log;try{log=JSON.parse(await (await (await d.getFileHandle('journal.json')).getFile()).text());}catch(e){if(e.name!=='NotFoundError')throw new Error('恢复记录无法读取，请保留输出目录：'+e.message);await root.removeEntry(JOURNAL42,{recursive:true});return;}
    if(log.version!==1||!Array.isArray(log.items)||!['prepared','committed'].includes(log.phase))throw new Error('恢复记录格式异常，已停止写入');
    if(log.phase==='prepared') {
      // Backups are on disk; restart recovery is idempotent, including a second interruption.
      for(var i=log.items.length-1;i>=0;i--) {
        var item=log.items[i];if(item.path.startsWith(JOURNAL42+'/'))throw new Error('恢复路径异常');
        if(item.existed){var p=await pathHandle42(root,item.path,true);await writeBlob(await p.dir.getFileHandle(p.name,{create:true}),await (await d.getFileHandle('old-'+i)).getFile());}
        else await removeAt42(root,item.path);
      }
    }
    await root.removeEntry(JOURNAL42,{recursive:true});
  }
  async function transaction42(root,changes,direct46) {
    if(!changes.length)return;
    await recover42(root);
    var d=await root.getDirectoryHandle(JOURNAL42,{create:true}),items=[],prepared=false;
    try {
      var seen=new Set();
      for(var i=0;i<changes.length;i++) {
        var c=changes[i];if(seen.has(c.path)||c.path.startsWith(JOURNAL42+'/'))throw new Error('重复的事务路径');seen.add(c.path);
        var old=null;try{old=await (await fileAt42(root,c.path)).getFile();}catch(e){if(e.name!=='NotFoundError')throw e;}
        if(old)await writeBlob(await d.getFileHandle('old-'+i,{create:true}),old);
        // Normal photo saves use independent snapshots. General moves still stage sources before overwriting any path.
        if(!direct46&&c.blob!==null)await writeBlob(await d.getFileHandle('new-'+i,{create:true}),c.blob);
        items.push({path:c.path,existed:!!old,deleted:c.blob===null});
      }
      var log={version:1,phase:'prepared',items:items};
      await writeBlob(await d.getFileHandle('journal.json',{create:true}),new Blob([JSON.stringify(log)]));prepared=true;
      for(var i=0;i<items.length;i++) {
        var item=items[i];
        if(item.deleted)await removeAt42(root,item.path);
        else {var p=await pathHandle42(root,item.path,true);await writeBlob(await p.dir.getFileHandle(p.name,{create:true}),direct46?changes[i].blob:await (await d.getFileHandle('new-'+i)).getFile());}
      }
      log.phase='committed';await writeBlob(await d.getFileHandle('journal.json',{create:true}),new Blob([JSON.stringify(log)]));
    } catch(e) {
      try{if(prepared)await recover42(root);else await root.removeEntry(JOURNAL42,{recursive:true});}
      catch(r){throw new Error('操作中断，恢复资料已保留；重新连接输出目录后自动恢复。'+r.message);}
      throw new Error('操作未完成，文件已恢复：'+e.message);
    }
    try{await root.removeEntry(JOURNAL42,{recursive:true});}catch(e){toast('成果已提交，临时恢复资料将在下次连接时清理');}
  }
  async function readOutputIndex(root){return outputLock(root,function(){return rawReadOutputIndex42(root);});}

  var DEFAULT_TERMS42=['全绝缘','绝缘保护套','绝缘护套','绝缘套','绝缘罩','绝缘包覆','绝缘包扎','裸导线','绝缘外露','绝缘'];
  function insulationTerms42(){
    var terms=DEFAULT_TERMS42.slice();
    try{var v=JSON.parse(localStorage.getItem('xunjian_insulation_terms_v1'));if(Array.isArray(v)&&v.length)terms=v.filter(function(x){return typeof x==='string'&&x.trim();});
      if(localStorage.getItem('xunjian_insulation_exposed_v44')!=='1'){
        if(!terms.includes('绝缘外露'))terms.push('绝缘外露');
        localStorage.setItem('xunjian_insulation_terms_v1',JSON.stringify(terms));
        localStorage.setItem('xunjian_insulation_exposed_v44','1');
      }
      if(localStorage.getItem('xunjian_insulation_general_v45')!=='1'){
        if(!terms.includes('绝缘'))terms.push('绝缘');
        localStorage.setItem('xunjian_insulation_terms_v1',JSON.stringify(terms));
        localStorage.setItem('xunjian_insulation_general_v45','1');
      }
    }catch(e){if(!terms.includes('绝缘外露'))terms.push('绝缘外露');if(!terms.includes('绝缘'))terms.push('绝缘');}
    return terms;
  }
  function isFullInsulationDefect(text){var normalized=String(text||'').normalize('NFKC');return insulationTerms42().some(function(term){return normalized.includes(term.normalize('NFKC'));});}
  function cleanName42(name){return name.replace(/__xj_[a-f0-9-]+(?=\.[^.]+$)/ig,'').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g,'');}
  async function inventory42(root,dirs) {
    var result=[];
    for(var dir of dirs){var d;try{d=await root.getDirectoryHandle(dir);}catch(e){if(e.name==='NotFoundError')continue;throw e;}
      async function walk(h,prefix){for await(var ent of h.values()){
        if(ent.name.startsWith('.'))continue;
        if(ent.kind==='directory')await walk(ent,prefix+ent.name+'/');
        else if(/\.(jpe?g|png|webp|bmp|tiff?)$/i.test(ent.name))result.push({dir:dir,path:prefix+ent.name,handle:ent});
      }}await walk(d,'');
    }return result;
  }
  function indexChange42(doc){return {path:INDEX_FILE,blob:new Blob([JSON.stringify(doc)],{type:'application/json'})};}
  async function organizeOutputs42(mode) {
    return withIO(async function(){
      if(!await ensureOutputDir())return;
      var root=output.mainHandle;
      if([DIR_BOX,DIR_ORIG,DIR_CRIT].includes(root.name))throw new Error('请选择包含三个成果目录的上一级输出目录');
      var outcome=await outputLock(root,async function(){
        var doc=await rawReadOutputIndex42(root),dirs=mode==='classify'?[DIR_BOX,DIR_ORIG]:[DIR_BOX,DIR_ORIG,DIR_CRIT];
        var files=await inventory42(root,dirs);if(!files.length)throw new Error('当前目录“'+root.name+'”下没有可整理的成果图片。请选择包含“缺陷圈示图”和“缺陷原图”的上一级输出目录。');var records=new Map(doc.records.map(function(r){return [r.dir+'/'+r.path,r];}));
        var garbage=new Set(doc.garbage.map(function(r){return r.dir+'/'+r.path;}));files=files.filter(function(f){return !garbage.has(f.dir+'/'+f.path);});
        if(mode==='classify')for(var dir of [DIR_BOX,DIR_ORIG]){var parent=await root.getDirectoryHandle(dir,{create:true});for(var category of ['全绝缘缺陷','其他缺陷'])await parent.getDirectoryHandle(category,{create:true});}
        var plans=[],reserved=new Set(files.map(function(f){return (f.dir+'/'+f.path).toLowerCase();})),paired=new Map();
        for(var f of files){var r=records.get(f.dir+'/'+f.path),pair=r&&(r.pairId||JSON.stringify([r.photoId,r.tag||'',r.path]));
          if(pair&&r.dir===DIR_BOX)paired.set(pair,r.tag||'');}
        // Keep relative subfolders; paired originals use their box's tags when available.
        var groups=new Map();
        for(var f of files){var r=records.get(f.dir+'/'+f.path);var key=r&&r.pairId?'pair:'+r.pairId:'path:'+f.path;
          if(!groups.has(key))groups.set(key,[]);groups.get(key).push({f:f,r:r});}
        var missing=0;
        for(var group of groups.values()){
          if(mode==='classify'&&group.some(function(x){return x.f.dir===DIR_BOX;})&&!group.some(function(x){return x.f.dir===DIR_ORIG;}))missing++;
          var first=group.find(function(x){return x.f.dir===DIR_BOX;})||group[0];
          var leaf=first.f.path.split('/').pop(),tag=(first.r&&first.r.tag)||leaf.replace(/\.[^.]+$/,'').split('_').slice(1).join('_')||leaf;
          var category=isFullInsulationDefect(tag)?'全绝缘缺陷':'其他缺陷';
          var targets=group.map(function(x){var p=x.f.path;
            if(mode==='classify')p=category+'/'+p.replace(/^(?:(?:全绝缘缺陷|其他缺陷|其它缺陷)\/)+/,'');
            else {var parts=p.split('/');parts[parts.length-1]=cleanName42(parts[parts.length-1]);p=parts.join('/');}
            return p;
          });
          if(group.every(function(x,i){return x.f.path===targets[i];}))continue;
          var n=1,candidates;
          while(true){candidates=targets.map(function(p){if(n===1)return p;var dot=p.lastIndexOf('.');return p.slice(0,dot)+'（'+n+'）'+p.slice(dot);});
            var blocked=false;for(var i=0;i<group.length;i++){var x=group[i],p=candidates[i];if(p===x.f.path)continue;
              if(reserved.has((x.f.dir+'/'+p).toLowerCase())){blocked=true;break;}
              try{await fileAt42(root,x.f.dir+'/'+p);blocked=true;break;}catch(e){if(e.name!=='NotFoundError')throw e;}
            }if(!blocked)break;if(++n>10000)throw new Error('同名文件过多');
          }
          group.forEach(function(x,i){if(x.f.path!==candidates[i]){plans.push({f:x.f,to:candidates[i]});reserved.add((x.f.dir+'/'+candidates[i]).toLowerCase());}});
        }
        if(!plans.length)return {count:0};
        var detail=plans.slice(0,8).map(function(p){return p.f.dir+'/'+p.f.path+' → '+p.to;}).join('\n');
        if(!await showConfirmDialog(mode==='classify'?'确认分类整理':'确认清理文件名',
          '将处理 '+plans.length+' 个图片文件。'+(mode==='classify'?'移动到各自目录内的“全绝缘缺陷／其他缺陷”，不会重复复制。':'只清理已知 __xj_ 随机后缀和不可见控制字符，保留正常文字。')+'\n\n'+detail+(plans.length>8?'\n……':'')+'\n\n同名文件保留并编号，文件关联记录同步更新。'))return {count:0,cancelled:true};
        if(window.DesktopFS){loadingEl.textContent='正在分类整理，请稍候…';loadingEl.style.display='';
          await DesktopFS.call('organize',{h:root,moves:plans.map(function(p){return {from:p.f.dir+'/'+p.f.path,to:p.f.dir+'/'+p.to};}),expectedIndex:doc});
          legacyCache46.delete(root);return {count:plans.length,missing:missing};
        }
        var changes=[],mapping=new Map();
        for(var p of plans){changes.push({path:p.f.dir+'/'+p.to,blob:await p.f.handle.getFile()});mapping.set(p.f.dir+'/'+p.f.path,p.to);}
        for(var p of plans)changes.push({path:p.f.dir+'/'+p.f.path,blob:null});
        var next=JSON.parse(JSON.stringify(doc));next.revision++;
        next.records.forEach(function(r){var to=mapping.get(r.dir+'/'+r.path);if(to)r.path=to;});
        changes.push(indexChange42(next));await transaction42(root,changes);
        return {count:plans.length,missing:missing};
      });
      if(!outcome.cancelled)recordOperation52('分类整理',output.mainHandle.name,'成功',outcome.count);
      await scanOutputDirectory();if(!outcome.cancelled)toast(outcome.count?'已完成：'+outcome.count+' 个文件，关联记录已同步'+(outcome.missing?'；其中 '+outcome.missing+' 组未匹配原图，请核对或补全':''):'没有需要处理的文件',6000);
      return outcome;
    });
  }
  async function classifyDefectsIntoInsulationFolders(){return organizeOutputs42('classify');}
  async function cleanOutputNames42(){return organizeOutputs42('clean');}

  // Decode at full resolution; retain a bounded working set and deduplicate in-flight reads.
  var cacheEpoch=0, imageVersions=new Map(), inflightImages=new Map(), decodeQueue=[], activeDecodes=0;
  var navSerial=0, requestedIndex=-1, preloadSerial=0, navigationPrompt=false;
  // Budget the reusable preview tier separately from the one on-demand detail image.
  // Export and detail decoding never run together. No full-resolution neighbour cache.
  var CACHE_BYTES=Math.max(48,Math.min(96,(navigator.deviceMemory||4)*16))*1024*1024;
  var activeBackground47=0,exportBusy47=false,preloadTimer47=0,navDirection47=1;
  var warmImages47=new Set(),warmOrder47=[],savedRefresh47=new Map();
  var imageClock=0;
  // disposeImage: i38 performance implementation below.

  function dropImage(id) {
    imageVersions.set(id,(imageVersions.get(id)||0)+1);
    disposeImage(state.cache.get(id));state.cache.delete(id);
  }
  function clearCache() {
    cacheEpoch++;navSerial++;preloadSerial++;requestedIndex=-1;
    clearTimeout(preloadTimer47);warmImages47.clear();warmOrder47=[];savedRefresh47.clear();
    cancelDetails38();Decoder38.reset();FastIndex.invalidate();clearTimeout(sideTimer38);sideScroll.inert=false;
    state.cache.forEach(disposeImage);state.cache.clear();inflightImages.clear();pumpDecode();
  }
  function decodeJob(job, background, ticket) {
    return new Promise(function(resolve,reject){
      var task={job:job,resolve:resolve,reject:reject,background:!!background,ticket:ticket};
      if(ticket)ticket.task=task;
      if(background)decodeQueue.push(task);else decodeQueue.unshift(task);
      pumpDecode();
    });
  }
  function pumpDecode(){
    // Drop obsolete queued work before reading a file or allocating a bitmap.
    for(var i=decodeQueue.length-1;i>=0;i--){
      var queued=decodeQueue[i];
      if(queued.ticket&&queued.ticket.stale&&queued.ticket.stale()){
        decodeQueue.splice(i,1);queued.reject(new Error('加载请求已更新'));
      }
    }
    decodeQueue.sort(function(a,b){return Number(a.background)-Number(b.background);});
    while(activeDecodes<2&&decodeQueue.length){
      var next=decodeQueue.findIndex(function(t){return !t.background||(!activeBackground47&&!state.navBusy&&!document.hidden&&(!ioBusy||!!savingPhoto46));});
      if(next<0)break;
      var task=decodeQueue.splice(next,1)[0],wasBackground=task.background;
      activeDecodes++;if(wasBackground)activeBackground47++;
      (function(t,bg){Promise.resolve().then(t.job).then(t.resolve,t.reject).finally(function(){
        activeDecodes--;if(bg)activeBackground47--;pumpDecode();
      });})(task,wasBackground);
    }
  }

  function loadImageElement(url) {
    return new Promise(function(resolve,reject) {
      var img=new Image();img.decoding='async';
      img.onload=async function() {
        try {if(img.decode) await img.decode();if(!img.naturalWidth) throw new Error('无效图片');resolve(img);}
        catch(e) {reject(new Error('图片解码失败：'+e.message));}
      };
      img.onerror=function(){reject(new Error('图片无法解码或格式不受浏览器支持'));};img.src=url;
    });
  }
  // getImage: i38 performance implementation below.

  // evictLRU: i38 performance implementation below.

  function preload(index) {
    if(index<0 || index>=state.files.length) return;
    getImage(index,false,true).catch(function(){});
  }
  // schedulePreload: i38 performance implementation below.

  // switchTo: i38 performance implementation below.


  async function cancelMarkedDefect(target) { return withIO(function(){return cancelMarkedDefectImpl(target);}); }
  async function cancelCriticalOnly(id) { return withIO(function(){return cancelCriticalOnlyImpl(id);}); }
  async function clearForSecondaryEdit() { return withIO(clearForSecondaryEditImpl); }
  window.addEventListener('beforeunload', function(e) { if(ioBusy||saveQueueBusy48()||SaveQueue48.stats().failed||viewedDirty48.size||viewedFlush48||recordPending46||recordFailures46.size) {e.preventDefault();e.returnValue='';} });
  var treeStatsTimer=null;
  function scheduleTreeStats() { if(treeStatsTimer)return;treeStatsTimer=setTimeout(function(){treeStatsTimer=null;FastIndex.paint();},180); }
  async function performRenamePhoto(index, newLocInput, oldLoc) { return withIO(function(){return performRenamePhotoImpl(index, newLocInput, oldLoc);}); }
  async function performRenameLineFolder(oldLineName, newLineName) { return withIO(function(){return performRenameLineFolderImpl(oldLineName, newLineName);}); }
  async function performRenameTowerFolder(lineName, oldTowerName, newTowerName) { return withIO(function(){return performRenameTowerFolderImpl(lineName, oldTowerName, newTowerName);}); }
  function renderPathTree(shouldScrollToActive) { Motion.change(function(){renderPathTreeContent(shouldScrollToActive);}); }
  function toggleGroupCollapse(prefix) { Motion.change(function(){toggleGroupCollapseContent(prefix);}); }
  function expandAllGroups() { Motion.change(function(){expandAllGroupsContent();}); }
  function collapseAllGroups() { Motion.change(function(){collapseAllGroupsContent();}); }
  // A single spring drives the selection capsule. List animations are bounded to visible items.
  var Motion = (function() {
    var media=window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : {matches:false};
    var host=$('pathTreeContainer'), layer=null, active=new Map(), frame=0, scrollFrame=0, scrollGoal=0, scrollMeasureFrame=0, pendingScrollRow=null, pendingScrollCenter=false, lastScrollRequest=0;
    var p={x:0,y:0,vx:0,vy:0,tx:0,ty:0,w:1,h:1,ready:false}, last=0, scrollTop=0;
    var lastPick=0, snapshotDepth=0, themeTimer=0, resizeFrame=0, resizeJob=null;
    function enabled() {return !media.matches && !document.hidden && !document.body.classList.contains('is-resizing');}
    function stop(el) {var a=active.get(el);if(a){a.cancel();active.delete(el);}}
    function animate(el,frames,options) {
      if(!el || !enabled() || !el.animate) return;
      stop(el);
      var a=el.animate(frames,Object.assign({duration:240,easing:'cubic-bezier(.2,.8,.2,1)'},options||{}));active.set(el,a);
      function release(){if(active.get(el)===a)active.delete(el);}
      a.onfinish=function(){release();if(el.classList && el.classList.contains('current') && pathTree.contains(el))select(false);};a.oncancel=release;
    }
    function key(el) {
      if(el.classList.contains('loc-item')) return 'p:'+el.dataset.idx;
      if(el.classList.contains('tower-header')) return 't:'+el.dataset.towerKey;
      return 'l:'+el.dataset.prefix;
    }
    function visible() {
      if(!enabled()) return [];
      var bounds=pathTree.getBoundingClientRect(), found=[];
      // Avoid geometry reads for the entire photo collection: walk only viewport hits when supported.
      if(document.elementsFromPoint) {
        var seen=new Set();
        for(var y=bounds.top+8;y<bounds.bottom;y+=16) {
          var hits=document.elementsFromPoint(bounds.left+Math.min(40,bounds.width/2),y);
          var el=hits.map(function(n){return n.closest && n.closest('.loc-item, .tower-header, .prefix-header');}).find(Boolean);
          if(el && pathTree.contains(el) && !seen.has(el)) {seen.add(el);found.push(el);}
          if(found.length>=42) break;
        }
      } else {
        var nodes=pathTree.querySelectorAll('.loc-item, .tower-header, .prefix-header');
        for(var i=0;i<Math.min(nodes.length,80);i++) {var r=nodes[i].getBoundingClientRect();if(r.height && r.bottom>bounds.top && r.top<bounds.bottom)found.push(nodes[i]);}
      }
      return found.map(function(el){return {el:el,key:key(el),rect:el.getBoundingClientRect()};});
    }
    function capture() {return new Map(visible().map(function(x){return [x.key,x.rect];}));}
    function rearrange(before) {
      var now=visible();
      // Read every rectangle before writing animation styles.
      now.forEach(function(item,i) {
        var old=before.get(item.key), dy=old?old.top-item.rect.top:8;
        if(old && Math.abs(dy)<.6) return;
        dy=Math.max(-120,Math.min(120,dy));
        animate(item.el,[{transform:'translateY('+dy+'px)',opacity:old?1:0},
          {transform:'translateY('+(-dy*.035)+'px)',opacity:1,offset:.78},
          {transform:'translateY(0)',opacity:1}],{duration:old?290:200,delay:old?0:Math.min(i,7)*9,easing:'cubic-bezier(.2,.75,.2,1)'});
      });
    }
    function change(job) {
      if(snapshotDepth || !enabled()) {job();select(false);return;}
      var before=capture();snapshotDepth++;
      try {job();} finally {snapshotDepth--;}
      // Cancel old animations after sampling their current visual positions.
      active.forEach(function(a,el){if(pathTree.contains(el)||!el.isConnected)stop(el);});
      select(true);rearrange(before);
    }
    function paint() {
      if(!layer || !p.ready) return;
      var stretch=enabled()?Math.min(.13,Math.abs(p.vy)/7500):0;
      layer.style.transform='translate3d('+p.x.toFixed(2)+'px,'+(p.y-p.h*stretch/2).toFixed(2)+'px,0) scale('+(1-stretch*.24).toFixed(4)+','+(1+stretch).toFixed(4)+')';
    }
    function tick(time) {
      frame=0;if(!enabled()){p.x=p.tx;p.y=p.ty;p.vx=p.vy=0;paint();return;}
      var dt=Math.min(.025,Math.max(.001,(time-last)/1000));last=time;
      // Semi-implicit integration with short substeps remains stable at 30/60/120 Hz.
      for(var n=0;n<3;n++) {var h=dt/3;p.vx+=(440*(p.tx-p.x)-33*p.vx)*h;p.vy+=(440*(p.ty-p.y)-33*p.vy)*h;p.x+=p.vx*h;p.y+=p.vy*h;}
      paint();
      if(Math.abs(p.y-p.ty)+Math.abs(p.x-p.tx)>.15 || Math.abs(p.vy)+Math.abs(p.vx)>1) frame=requestAnimationFrame(tick);
      else {p.x=p.tx;p.y=p.ty;p.vx=p.vy=0;paint();}
    }
    function select(spring) {
      if(!layer) return;
      var row=activeTreeRow;
      if(!row || !row.getClientRects().length || media.matches) {layer.style.opacity='0';p.ready=false;return;}
      var r=row.getBoundingClientRect(), b=host.getBoundingClientRect();
      p.tx=r.left-b.left;p.ty=r.top-b.top;
      if(r.bottom<b.top || r.top>b.bottom){layer.style.opacity='0';p.ready=false;return;}
      var jump=!p.ready || Math.abs(p.ty-p.y)>b.height*.8;
      p.w=r.width;p.h=r.height;layer.style.width=p.w+'px';layer.style.height=p.h+'px';layer.style.opacity='1';
      if(!spring || jump || !enabled()){p.x=p.tx;p.y=p.ty;p.vx=p.vy=0;}
      p.ready=true;scrollTop=pathTree.scrollTop;paint();
      if(spring && enabled() && !frame){last=performance.now();frame=requestAnimationFrame(tick);}
    }
    function cancelScroll(){if(scrollFrame)cancelAnimationFrame(scrollFrame);if(scrollMeasureFrame)cancelAnimationFrame(scrollMeasureFrame);scrollFrame=scrollMeasureFrame=0;pendingScrollRow=null;}
    function scrollToRow(row,center) {
      if(!row)return;
      pendingScrollRow=row;pendingScrollCenter=!!center;
      if(scrollFrame){cancelAnimationFrame(scrollFrame);scrollFrame=0;}
      // Collapse/expand writes settle before one geometry read for the latest navigation request.
      if(scrollMeasureFrame)return;
      scrollMeasureFrame=requestAnimationFrame(function(){
        scrollMeasureFrame=0;var row=pendingScrollRow,center=pendingScrollCenter;pendingScrollRow=null;if(!row||!row.isConnected)return;
        var r=row.getBoundingClientRect(),b=pathTree.getBoundingClientRect(),target=pathTree.scrollTop;
        if(center)target+=r.top-b.top-(b.height-r.height)/2;
        else if(r.top<b.top+12)target+=r.top-b.top-12;
        else if(r.bottom>b.bottom-12)target+=r.bottom-b.bottom+12;
        else return;
        scrollGoal=Math.max(0,Math.min(pathTree.scrollHeight-pathTree.clientHeight,target));
        var now=performance.now(),rapid=now-lastScrollRequest<120;lastScrollRequest=now;
        if(!enabled()||Math.abs(scrollGoal-pathTree.scrollTop)<1){pathTree.scrollTop=scrollGoal;select(false);return;}
        var from=pathTree.scrollTop,start=now,duration=rapid?70:180;
        function step(t){var k=Math.min(1,(t-start)/duration);pathTree.scrollTop=from+(scrollGoal-from)*(1-Math.pow(1-k,3));if(k<1)scrollFrame=requestAnimationFrame(step);else{scrollFrame=0;select(false);}}
        scrollFrame=requestAnimationFrame(step);
      });
    }
    function photo() {
      var now=performance.now();select(true);
      // Never animate the canvas geometry: preserve exact pointer-to-pixel alignment.
      if(false) animate(baseCanvas,[{opacity:.82},{opacity:1}],{duration:120});
      else stop(baseCanvas);
      lastPick=now;
    }
    function panel(el){animate(el,[{opacity:.65,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:170});}
    function theme(){clearTimeout(themeTimer);document.body.classList.add('motion-theme');themeTimer=setTimeout(function(){document.body.classList.remove('motion-theme');},220);}
    function resize(which,w) {resizeJob={which:which,w:w};if(resizeFrame)return;resizeFrame=requestAnimationFrame(function(){resizeFrame=0;var j=resizeJob;resizeJob=null;if(j.which==='left')applyLeftWidth(j.w);else applyRightWidth(j.w);select(false);});}
    function cancelAll(){cancelScroll();if(frame)cancelAnimationFrame(frame);frame=0;active.forEach(function(a){a.cancel();});active.clear();select(false);}
    function init() {
      if(!host)return;
      layer=document.createElement('div');layer.className='motion-selection';layer.setAttribute('aria-hidden','true');host.appendChild(layer);
      document.body.classList.add('motion-ready');scrollTop=pathTree.scrollTop;
      pathTree.addEventListener('scroll',function(){var delta=pathTree.scrollTop-scrollTop;scrollTop=pathTree.scrollTop;p.y-=delta;p.ty-=delta;paint();},{passive:true});
      pathTree.addEventListener('wheel',cancelScroll,{passive:true});pathTree.addEventListener('pointerdown',cancelScroll,{passive:true});
      window.addEventListener('resize',function(){select(false);},{passive:true});
      document.addEventListener('visibilitychange',function(){if(document.hidden)cancelAll();});
      if(media.addEventListener)media.addEventListener('change',cancelAll);
      // Hidden panels cannot keep invisible keyboard targets during their exit transitions.
      if(window.MutationObserver) Array.from(document.querySelectorAll('.overlay, #settingsPanel, #moreToolsMenu')).forEach(function(el){
        function sync(){el.inert=!el.classList.contains('show');}
        sync();new MutationObserver(sync).observe(el,{attributes:true,attributeFilter:['class']});
      });
    }
    return {init:init,stopPhoto:function(){stop(baseCanvas);},change:change,select:select,scroll:scrollToRow,photo:photo,panel:panel,theme:theme,resize:resize,cancel:cancelAll};
  })();

  // i38: indexed counters and navigation. Nothing here walks the collection on a normal photo change.
  var FastIndex=(function(){
    var source=null,marks=null,counts=null,dirs=null,rows=[],lines=new Map(),towers=new Map(),trees={},summary={},review={},lastViewed=-1,dirty=new Set();
    function invalidate(){source=null;}
    function markedChanged(i,oldCount,newCount){
      var row=rows[i];if(!row){invalidate();return;}
      var delta=Number(newCount>0)-Number(oldCount>0);
      [row.t,row.l,summary].forEach(function(g){g.marked+=delta;g.defects+=newCount-oldCount;});
      add(trees.marked,i,delta);add(trees.unmarked,i,-delta);dirty.add(row.t.key);dirty.add(row.l.key);
    }
    function add(tree,i,v){for(i++;i<tree.length;i+=i&-i)tree[i]+=v;}
    function sum(tree,end){var n=0;for(var i=Math.min(end,tree.length-1);i>0;i-=i&-i)n+=tree[i];return n;}
    function kth(tree,k){if(k<1||k>sum(tree,tree.length-1))return -1;var idx=0;for(var step=2**Math.floor(Math.log2(tree.length));step;step=Math.floor(step/2)){var next=idx+step;if(next<tree.length&&tree[next]<k){idx=next;k-=tree[next];}}return idx;}
    function leafDirs(){var sorted=Array.from(new Set(state.discoveredDirs||[])).sort();return sorted.filter(function(d,i){return !sorted[i+1]||!sorted[i+1].startsWith(d);});}
    function ensure(){
      if(source===state.files&&marks===state.markedFiles&&counts===state.markedCounts&&dirs===state.discoveredDirs)return;
      source=state.files;marks=state.markedFiles;counts=state.markedCounts;dirs=state.discoveredDirs;
      rows=[];lines=new Map();towers=new Map();dirty=new Set();lastViewed=-1;review={pending:0,clear:0,defect:0,review:0,unusable:0};
      summary={total:source.length,marked:0,defects:0,viewed:0,started:0,finished:0};
      trees={marked:new Int32Array(source.length+1),unmarked:new Int32Array(source.length+1),unviewed:new Int32Array(source.length+1)};
      function group(pfx,twr){
        var l=lines.get(pfx);if(!l){l={key:pfx,total:0,marked:0,defects:0,viewed:0,towers:0,started:0,finished:0};lines.set(pfx,l);}
        var key=pfx+':::'+twr,t=towers.get(key);if(!t){t={key:key,line:l,total:0,marked:0,defects:0,viewed:0};towers.set(key,t);l.towers++;}return t;
      }
      leafDirs().forEach(function(d){var info=parseDirToLineAndTower(d);group(info.prefix,info.tower);});
      source.forEach(function(f,i){
        var info=parseFilePrefixAndLocation(f.name,f.relPath),t=group(info.prefix,info.tower),l=t.line;
        var seen=!!viewedPhotosMap[f.id],marked=marks.has(f.id),n=marked?(counts.get(f.id)||1):0;
        rows.push({f:f,info:info,t:t,l:l,viewed:seen});
        [t,l,summary].forEach(function(g){g.total+=(g===summary?0:1);g.marked+=marked?1:0;g.defects+=n;g.viewed+=seen?1:0;});
        if(seen)lastViewed=i;
        trees.marked[i+1]=marked?1:0;trees.unmarked[i+1]=marked?0:1;trees.unviewed[i+1]=seen?0:1;
        var st=reviewOf(f.id).status;review[st]=(review[st]||0)+1;
      });
      Object.values(trees).forEach(function(tree){for(var i=1;i<tree.length;i++){var p=i+(i&-i);if(p<tree.length)tree[p]+=tree[i];}});
      towers.forEach(function(t){if(t.viewed>0){t.line.started++;summary.started++;}if(t.total>0&&t.viewed===t.total){t.line.finished++;summary.finished++;}dirty.add(t.key);});
    }
    function viewed(i){ensure();var r=rows[i];if(!r||r.viewed)return;var t=r.t,l=r.l;
      r.viewed=true;viewedPhotosMap[r.f.id]=true;viewedDirty48.set(r.f.id,true);lastViewed=Math.max(lastViewed,i);
      if(t.viewed===0){l.started++;summary.started++;}t.viewed++;l.viewed++;summary.viewed++;if(t.viewed===t.total){l.finished++;summary.finished++;}
      add(trees.unviewed,i,-1);dirty.add(t.key);
    }
    function reviewChanged(oldStatus,newStatus){ensure();if(oldStatus===newStatus)return;review[oldStatus]--;review[newStatus]=(review[newStatus]||0)+1;}
    function next(from,step){ensure();if(filterMode==='all'){var n=from+step;return n>=0&&n<source.length?n:-1;}var tree=trees[filterMode];if(!tree)return -1;return step>0?kth(tree,sum(tree,from+1)+1):kth(tree,sum(tree,Math.max(0,from)));}
    function position(i){ensure();if(filterMode==='all')return {count:source.length,pos:i+1};var t=trees[filterMode];return {count:sum(t,source.length),pos:sum(t,i+1)};}
    function paint(){ensure();
      function txt(el,value){if(el&&el.textContent!==value)el.textContent=value;}
      pathTree.querySelectorAll('.tower-group[data-tower-key]').forEach(function(el){var t=towers.get(el.dataset.towerKey);if(!t)return;txt(el.querySelector('.tower-viewed-badge'),'已看 '+t.viewed+'/'+t.total);txt(el.querySelector('.tower-marked-badge'),t.marked?'已标 '+t.marked+'/'+t.total:t.total+' 张');});
      pathTree.querySelectorAll('.prefix-group[data-prefix]').forEach(function(el){var l=lines.get(el.dataset.prefix);if(!l)return;txt(el.querySelector('.line-viewed-badge'),'已看 '+l.finished+'/'+l.towers+'基');txt(el.querySelector('.line-marked-badge'),l.marked?'已标 '+l.marked+'/'+l.total:l.total+' 张');});dirty.clear();
      txt(dirSummaryText,lines.size+' 线路 · 已标 '+summary.marked+'/'+summary.total+' · 已看 '+summary.finished+'/'+towers.size+' 杆塔');
      dirSummaryText.title='已标记 '+summary.marked+' 张照片，共 '+summary.defects+' 处缺陷输出；已完整查看 '+summary.finished+' 基杆塔，累计查勘 '+summary.started+' 基杆塔';
      txt(btnFilterAll,'全部 ('+summary.total+')');txt(btnFilterMarked,'已标记 ('+summary.marked+')');txt(btnFilterUnmarked,'未标记 ('+(summary.total-summary.marked)+')');txt(btnFilterUnviewed,'未看 ('+(summary.total-summary.viewed)+')');
    }
    return {ensure:ensure,invalidate:invalidate,markedChanged:markedChanged,viewed:viewed,next:next,position:position,paint:paint,leafDirs:leafDirs,reviewChanged:reviewChanged,
      groupStats:function(kind,key){ensure();return kind==='line'?lines.get(key):towers.get(key);},
      review:function(){ensure();return review;},last:function(){ensure();return lastViewed;}};
  })();
  var treeRows=new Map(),activeTreeRow=null;
  function indexTreeRows(){treeRows.clear();pathTree.querySelectorAll('.loc-item[data-idx]').forEach(function(el){treeRows.set(Number(el.dataset.idx),el);});activeTreeRow=pathTree.querySelector('.loc-item.current');pathTree.classList.toggle('tree-centered44',treeRows.size>0);}
  function updatePathTreeSelection(newIdx,scroll){VirtualTree48.select(newIdx,scroll);}
  function refreshTreeStats(){FastIndex.paint();}
  function getNextFilteredIndex(from,step){return FastIndex.next(from,step);}
  function updateReviewUI(){
    var selector=$('reviewStatus'),critical=$('criticalDecision');if(!selector)return;
    var id=curName(),r=reviewOf(id);selector.disabled=critical.disabled=!id||editLocked48();selector.value=r.status;critical.value=r.decision;
    var c=FastIndex.review(),text='检查完成 '+(c.clear+c.defect)+'/'+state.files.length+' · 待检 '+c.pending+' · 复核 '+c.review+' · 不可用 '+c.unusable;
    if($('reviewSummary').textContent!==text)$('reviewSummary').textContent=text;var progress=$('inspectionProgress48');if(progress){progress.max=Math.max(1,state.files.length);progress.value=c.clear+c.defect;progress.title=text;}
  }

  // Worker source is embedded so the downloaded HTML remains a single offline file.
  function imageWorker38(){
    async function dimensions(blob){
      var a=new Uint8Array(await blob.slice(0,262144).arrayBuffer()),v=new DataView(a.buffer),w=0,h=0,o=1;
      if(a.length>24&&v.getUint32(0)===0x89504e47){w=v.getUint32(16);h=v.getUint32(20);}
      else if(a[0]===255&&a[1]===216){
        var p=2;
        while(p+4<a.length){if(a[p]!==255)break;var m=a[p+1];p+=2;if(m===217||m===218)break;if(m===255){p--;continue;}var n=v.getUint16(p);if(n<2||p+n>a.length)break;
          if(m===225&&n>16&&v.getUint32(p+2)===0x45786966){try{var t=p+8,le=v.getUint16(t)===0x4949,ifd=t+v.getUint32(t+4,le),count=v.getUint16(ifd,le);for(var j=0;j<count;j++){var q=ifd+2+j*12;if(q+12>a.length)break;if(v.getUint16(q,le)===274){o=v.getUint16(q+8,le);break;}}}catch(e){}}
          if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m)){h=v.getUint16(p+3);w=v.getUint16(p+5);}p+=n;
        }
        if(o>=5&&o<=8){var tmp=w;w=h;h=tmp;}
      }
      return w&&h?{w:w,h:h}:null;
    }
    self.onmessage=async function(e){var d=e.data,bmp=null;
      try{
        var dims=await dimensions(d.blob);
        if(d.full){bmp=await createImageBitmap(d.blob);dims={w:bmp.width,h:bmp.height};}
        else if(dims){var scale=Math.min(1,d.edge/Math.max(dims.w,dims.h));bmp=await createImageBitmap(d.blob,{resizeWidth:Math.max(1,Math.round(dims.w*scale)),resizeHeight:Math.max(1,Math.round(dims.h*scale)),resizeQuality:'medium'});}
        else {var original=await createImageBitmap(d.blob);dims={w:original.width,h:original.height};var s=Math.min(1,d.edge/Math.max(dims.w,dims.h));if(s<1){try{bmp=await createImageBitmap(original,{resizeWidth:Math.max(1,Math.round(dims.w*s)),resizeHeight:Math.max(1,Math.round(dims.h*s)),resizeQuality:'medium'});}finally{original.close();}}else bmp=original;}
        self.postMessage({id:d.id,bitmap:bmp,w:dims.w,h:dims.h},[bmp]);bmp=null;
      }catch(err){if(bmp)bmp.close();self.postMessage({id:d.id,error:String(err.message||err)});}
    };
  }
  var Decoder38=(function(){
    var url=null,lanes=[],pending=new Map(),seq=0,disabled=!window.Worker;
    function stopLane(i){var lane=lanes[i];if(lane){lane.terminate();lanes[i]=null;}pending.forEach(function(p,id){if(p.lane===i){clearTimeout(p.timer);p.reject(new Error('解码请求已更新'));pending.delete(id);}});}
    function worker(i){if(lanes[i])return lanes[i];if(!url)url=URL.createObjectURL(new Blob(['('+imageWorker38.toString()+')()'],{type:'text/javascript'}));
      var w=new Worker(url);w.onmessage=function(e){var r=e.data,p=pending.get(r.id);if(!p){if(r.bitmap)r.bitmap.close();return;}pending.delete(r.id);clearTimeout(p.timer);if(r.error)p.reject(new Error(r.error));else p.resolve(r);};
      w.onerror=function(){disabled=true;stopLane(i);};lanes[i]=w;return w;
    }
    async function fallback(blob,full){
      var u=URL.createObjectURL(blob),img=null,canvas=null;
      try{
        img=await loadImageElement(u);var w=img.naturalWidth,h=img.naturalHeight;
        if(!window.createImageBitmap)return {img:img,url:u,w:w,h:h};
        if(full){var fullBitmap=await createImageBitmap(img);img.src='';URL.revokeObjectURL(u);return {bitmap:fullBitmap,w:w,h:h};}
        var scale=Math.min(1,1440/Math.max(w,h));canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        var bitmap=await createImageBitmap(canvas);return {bitmap:bitmap,w:w,h:h};
      }catch(e){if(img)img.src='';URL.revokeObjectURL(u);throw e;}
      finally{if(canvas){canvas.width=canvas.height=1;if(img)img.src='';URL.revokeObjectURL(u);}}
    }

    async function decode(blob,full,background){
      if(disabled)return fallback(blob,full);
      var lane=full?2:(background?1:0),w;
      try{w=worker(lane);}catch(e){disabled=true;return fallback(blob,full);}
      try {return await new Promise(function(resolve,reject){var id=++seq,timer=setTimeout(function(){stopLane(lane);},30000);pending.set(id,{resolve:resolve,reject:reject,lane:lane,timer:timer});try{w.postMessage({id:id,blob:blob,full:!!full,edge:1440});}catch(e){pending.delete(id);clearTimeout(timer);reject(e);}});}
      catch(e){if(disabled)return fallback(blob,full);throw e;}
    }
    return {decode:decode,cancelDetail:function(){stopLane(2);},reset:function(){for(var i=0;i<3;i++)stopLane(i);}};
  })();
  var detailTimer38=0,detailTask38=null,sideTimer38=0,navActiveUntil38=0;
  function quality38(){var c=state.cache.get(curName()),el=$('imageQuality');if(el)el.textContent=!c?'':c.fullBitmap||!c.previewBitmap||c.previewBitmap.width>=c.img.naturalWidth?'原图清晰度':detailTask38&&detailTask38.id===curName()?'正在加载原图细节…':'快速预览 · 放大加载原图';}
  function needsDetail38(c){return c&&c.previewBitmap&&!c.fullBitmap&&c.previewBitmap.width<c.img.naturalWidth&&state.view.s*state.view.zoom*(window.devicePixelRatio||1)>c.previewBitmap.width/c.img.naturalWidth*1.08;}
  function detail38(){
    clearTimeout(detailTimer38);
    var id=curName(),c=state.cache.get(id);if(!needsDetail38(c)||exportBusy47||(ioBusy&&!savingPhoto46)||document.hidden){quality38();return;}
    if(detailTask38&&detailTask38.id===id)return;
    detailTimer38=setTimeout(async function(){
      if(id!==curName()||!needsDetail38(c)||state.navBusy||exportBusy47||(ioBusy&&!savingPhoto46)||document.hidden)return;
      var task={id:id};detailTask38=task;quality38();
      try{
        var decoded=await Decoder38.decode(c.blob,true,false);
        if(curName()!==id||state.cache.get(id)!==c||detailTask38!==task){if(decoded.bitmap)decoded.bitmap.close();if(decoded.url)URL.revokeObjectURL(decoded.url);return;}
        state.cache.forEach(function(other){if(other!==c&&other.fullBitmap){other.fullBitmap.close();other.fullBitmap=null;other.img.bitmap=other.previewBitmap;}});
        if(decoded.bitmap){c.fullBitmap=decoded.bitmap;c.img.bitmap=decoded.bitmap;}
        else if(decoded.img){c.img=decoded.img;c.url=decoded.url;}
        evictLRU(state.index);renderBase();
      }catch(e){if(curName()===id&&detailTask38===task)toast('原图细节加载失败，可缩小后重新放大重试',4000);}
      finally{if(detailTask38===task)detailTask38=null;quality38();}
    },100);
  }
  function cancelDetails38(){clearTimeout(detailTimer38);detailTask38=null;Decoder38.cancelDetail();}
  function disposeImage(c){if(!c)return;if(c.url)URL.revokeObjectURL(c.url);if(c.previewBitmap)c.previewBitmap.close();if(c.fullBitmap&&c.fullBitmap!==c.previewBitmap)c.fullBitmap.close();if(c.img&&!c.img.bitmap){c.img.onload=null;c.img.onerror=null;c.img.src='';}c.blob=null;c.img=null;c.previewBitmap=null;c.fullBitmap=null;c.url=null;}
  async function getImage(index,preferClean,background,requestToken){
    var f=state.files[index];if(!f)throw new Error('照片不存在');var id=f.id,isMarked=!preferClean&&!getMeta(id).isSecondaryEdit&&state.markedFiles.has(id)&&state.markedBoxedHandles.has(id),c=state.cache.get(id);
    if(c&&c.img&&!c.stale47&&c.isBoxed===!!isMarked){c.used=++imageClock;return c;}
    var epoch=cacheEpoch,version=imageVersions.get(id)||0,key=id+'|'+Number(isMarked)+'|'+version+'|'+epoch;
    if(inflightImages.has(key)){var shared=inflightImages.get(key);if(requestToken!==undefined){shared.ticket.navToken=requestToken;shared.ticket.background=false;shared.ticket.task.background=false;var qi=decodeQueue.indexOf(shared.ticket.task);if(qi>=0){decodeQueue.splice(qi,1);decodeQueue.unshift(shared.ticket.task);}pumpDecode();}return shared.promise;}
    var ticket={navToken:requestToken,background:!!background,preloadGeneration:preloadSerial},handle=isMarked?state.markedBoxedHandles.get(id):f.handle;
    ticket.stale=function(){return epoch!==cacheEpoch||version!==(imageVersions.get(id)||0)||
      (ticket.navToken!==undefined&&ticket.navToken!==navSerial)||
      (ticket.background&&ticket.preloadGeneration!==preloadSerial&&!warmImages47.has(id));};
    var promise=decodeJob(async function(){
      if(ticket.stale())throw new Error('加载请求已更新');
      var blob=(!isMarked&&f.file)?f.file:await handle.getFile(),decoded=await Decoder38.decode(blob,false,ticket.background);
      var item={img:decoded.img||{naturalWidth:decoded.w,naturalHeight:decoded.h,bitmap:decoded.bitmap},previewBitmap:decoded.bitmap||null,url:decoded.url||null,
        blob:blob,isBoxed:!!isMarked,bakedCount:isMarked?(getMeta(id).saved&&!getMeta(id).isSecondaryEdit?getMeta(id).boxes.length:(getMeta(id).desktopBakedCount50||0)):0,origName:f.name,used:++imageClock,bytes:decoded.bitmap?decoded.bitmap.width*decoded.bitmap.height*4:decoded.w*decoded.h*4};
      if(ticket.stale()){disposeImage(item);throw new Error('加载请求已更新');}
      var previous=state.cache.get(id);if(previous)disposeImage(previous);state.cache.set(id,item);evictLRU(index);return item;
    },background,ticket);
    var entry={promise:promise,ticket:ticket};inflightImages.set(key,entry);try{return await promise;}finally{if(inflightImages.get(key)===entry)inflightImages.delete(key);}
  }
  function imageBytes46(c){
    var bytes=c.blob?c.blob.size:0;
    if(c.previewBitmap)bytes+=c.previewBitmap.width*c.previewBitmap.height*4;
    else if(c.img)bytes+=c.img.naturalWidth*c.img.naturalHeight*4;
    if(c.fullBitmap&&c.fullBitmap!==c.previewBitmap)bytes+=c.fullBitmap.width*c.fullBitmap.height*4;
    return bytes;
  }
  function previewBytes47(c){
    var bytes=imageBytes46(c);
    if(c.fullBitmap&&c.fullBitmap!==c.previewBitmap)bytes-=c.fullBitmap.width*c.fullBitmap.height*4;
    return bytes;
  }
  function releaseDetail47(c){
    if(c&&c.fullBitmap){c.fullBitmap.close();c.fullBitmap=null;c.img.bitmap=c.previewBitmap;}
  }
  function evictLRU(protectIndex){
    state.cache.forEach(function(c,id){if(id!==curName())releaseDetail47(c);});
    var total=0;state.cache.forEach(function(c){total+=previewBytes47(c);});
    var protect=new Set([curName(),state.files[requestedIndex]&&state.files[requestedIndex].id,state.files[protectIndex]&&state.files[protectIndex].id]);
    var candidates=Array.from(state.cache.entries()).filter(function(p){return !protect.has(p[0]);}).sort(function(a,b){
      // Evict distant previews first. Nearby previews are still subject to the byte budget.
      var priority=Number(warmImages47.has(a[0]))-Number(warmImages47.has(b[0]));
      return priority||((a[1].used||0)-(b[1].used||0));
    });
    for(var pair of candidates){if(total<=CACHE_BYTES&&state.cache.size<=32)break;total-=previewBytes47(pair[1]);dropImage(pair[0]);}
  }
  function trimForExport46(){
    // Keep decoded neighbours: saving must not turn the next navigation into a cold read.
    state.cache.forEach(releaseDetail47);evictLRU(state.index);quality38();
  }
  function prepareWarmWindow47(index,direction){
    navDirection47=direction<0?-1:1;
    var order=[],ahead=index,behind=index,seen=new Set();
    function append(i){if(i>=0&&!seen.has(i)){seen.add(i);order.push(i);}}
    // The nearest image in each direction is ready before distant speculative work.
    for(var n=0;n<5;n++){
      if(ahead>=0){ahead=getNextFilteredIndex(ahead,navDirection47);append(ahead);}
      if(n<2&&behind>=0){behind=getNextFilteredIndex(behind,-navDirection47);append(behind);}
    }
    warmOrder47=order;warmImages47=new Set(order.map(function(i){return state.files[i].id;}));
    if(state.files[index])warmImages47.add(state.files[index].id);
    return order;
  }
  function schedulePreload(index,direction){
    var serial=++preloadSerial,order=prepareWarmWindow47(index,direction);
    clearTimeout(preloadTimer47);
    preloadTimer47=setTimeout(async function(){
      for(var target of order){
        if(serial!==preloadSerial||document.hidden||(ioBusy&&!savingPhoto46))return;
        try{await getImage(target,false,true);}catch(e){}
      }
    },12);
    pumpDecode();
  }
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){
      preloadSerial++;clearTimeout(preloadTimer47);cancelDetails38();
      state.cache.forEach(function(c,id){releaseDetail47(c);if(!warmImages47.has(id)&&id!==curName())dropImage(id);});pumpDecode();
    }else if(state.index>=0){schedulePreload(state.index,navDirection47);detail38();}
  });
  function refreshSavedPreview47(id,boxes){
    // The export has already committed. Keep the old visible surface until the new preview is ready.
    var index=state.indexByName.get(id),c=state.cache.get(id);
    if(c)c.stale47=true;
    imageVersions.set(id,(imageVersions.get(id)||0)+1);
    if(index===undefined)return;
    var ticket={epoch:cacheEpoch,nav:navSerial};savedRefresh47.set(id,ticket);
    if(curName()!==id){savedRefresh47.delete(id);return;}
    getImage(index,false,true).then(function(next){
      if(savedRefresh47.get(id)!==ticket||ticket.epoch!==cacheEpoch)return;
      next.bakedCount=boxes.length;
      if(curName()===id&&!state.navBusy&&state.cache.get(id)===next){
        state.natural={w:next.img.naturalWidth,h:next.img.naturalHeight};render();updateHud();quality38();
      }
    }).catch(function(e){
      // A newer navigation/save supersedes this refresh; it is not a failed disk write.
      if(savedRefresh47.get(id)===ticket&&curName()===id&&!state.navBusy&&ticket.nav===navSerial)
        toast('图片已保存，预览稍后重试；可继续切换图片',4500);
    }).finally(function(){if(savedRefresh47.get(id)===ticket)savedRefresh47.delete(id);});
  }

  function sideAfterNav38(){clearTimeout(sideTimer38);sideScroll.inert=true;sideTimer38=setTimeout(function(){renderSide();sideScroll.inert=false;},90);}
  async function switchTo(index,force){
    if((ioBusy&&!savingPhoto46)||navigationPrompt||index<0||index>=state.files.length)return false;if(index===state.index&&!force&&!state.navBusy)return true;
    var m=curName()?getMeta(curName()):null;
    if(!force&&m&&!m.saved&&!photoPending48(curName())&&(m.boxes.length||m.appended.length)){navigationPrompt=true;var ok;try{ok=await showConfirmDialog('未保存提醒','当前照片有未保存的圈框或标签，是否切换？');}finally{navigationPrompt=false;}if(!ok)return false;}
    var token=++navSerial,old=state.index,f=state.files[index];requestedIndex=index;state.navBusy=true;preloadSerial++;prepareWarmWindow47(index,index>=old?1:-1);cancelDetails38();pumpDecode();navActiveUntil38=performance.now()+160;
    if(Motion.stopPhoto)Motion.stopPhoto();
    var timer=setTimeout(function(){if(token===navSerial)loadingEl.style.display='';},120);
    try{
      // Merge bursts before uncached disk reads. Cached neighbors still display on the next frame.
      if(!state.cache.has(f.id)&&old>=0)await new Promise(function(r){setTimeout(r,18);});
      if(token!==navSerial)return false;
      var c=await getImage(index,undefined,false,token);if(token!==navSerial)return false;
      await new Promise(function(r){requestAnimationFrame(r);});if(token!==navSerial)return false;
      state.index=index;selectedIndex=-1;state.natural={w:c.img.naturalWidth,h:c.img.naturalHeight};var fit=computeFit(state.natural.w,state.natural.h);fitView(fit.w,fit.h,fit.s);render();
      if(!viewedPhotosMap[f.id]){FastIndex.viewed(index);saveViewedPhotos();}
      updateHud();updatePathTreeSelection(index,true);Motion.select(true);sideAfterNav38();quality38();scheduleTreeStats();schedulePreload(index,index>=old?1:-1);
      return true;
    }catch(e){if(token===navSerial){state.index=index;selectedIndex=-1;render();updateHud();updatePathTreeSelection(index,true);sideAfterNav38();Motion.select(false);quality38();toast('加载失败：'+f.name+'，未计入已看。',4500);}return false;}
    finally{clearTimeout(timer);if(token===navSerial){state.navBusy=false;requestedIndex=-1;loadingEl.style.display='none';updateReviewUI();evictLRU(state.index);pumpDecode();}}
  }

  // The DOM contains only the viewport plus overscan, regardless of the number of input photos.
  var VirtualTree48=(function(){
    var source=null,lastDataset=null,groups=[],groupByKey=new Map(),photoGroup=[],blocks=[],rowCount=0,matches=0;
    var rowHeight=40,overscan=8,frame=0,scrollFrame=0,container=null,lastCurrent=-1,first=-1,last=-1;
    function invalidate(){source=null;}
    function ensure(){
      if(source===state.files)return;source=state.files;groups=[];groupByKey=new Map();photoGroup=[];lastCurrent=-1;
      var lines=new Map();
      function tower(p){
        var l=lines.get(p.prefix);if(!l){l={kind:'line',key:p.prefix,name:p.prefix,towers:[],indices:[]};lines.set(p.prefix,l);groups.push(l);}
        var key=p.prefix+':::'+p.tower,t=groupByKey.get(key);
        if(!t){t={kind:'tower',key:key,name:p.tower,line:l,indices:[],num:p.towerNum||0};groupByKey.set(key,t);l.towers.push(t);}return t;
      }
      FastIndex.leafDirs().forEach(function(d){tower(parseDirToLineAndTower(d));});
      state.files.forEach(function(f,i){var t=tower(parseFilePrefixAndLocation(f.name,f.relPath));t.indices.push(i);t.line.indices.push(i);photoGroup[i]=t;});
      groups.sort(function(a,b){return naturalCollator48.compare(a.name,b.name);});
      groups.forEach(function(l){l.towers.sort(function(a,b){return a.num-b.num||naturalCollator48.compare(a.name,b.name);});});
      if(lastDataset!==state.files){lastDataset=state.files;var current=photoGroup[state.index];groups.forEach(function(l){if(!current||current.line!==l)collapsedGroups.add(l.key);else collapsedGroups.delete(l.key);l.towers.forEach(function(t){if(t!==current)collapsedTowers.add(t.key);else collapsedTowers.delete(t.key);});});}
    }
    function passes(i){return isFileMatchingFilter(i)||(i===state.index&&filterMode==='unviewed');}
    function lowerBound(ids,index){var a=0,b=ids.length;while(a<b){var m=(a+b)>>>1;if(ids[m]<index)a=m+1;else b=m;}return a;}
    function visible(t){
      var key=filterMode+'\0'+directoryQuery43;
      if(t.filterKey!==key){t.filterKey=key;t.visible=filterMode==='all'&&!directoryQuery43?t.indices:t.indices.filter(function(i){return passes(i)&&directoryMatches43(state.files[i]);});}
      return t.visible;
    }
    function dirty(index){
      var t=photoGroup[index];if(!t||t.filterKey!==filterMode+'\0'+directoryQuery43||t.visible===t.indices)return;
      var ids=t.visible,pos=lowerBound(ids,index),has=ids[pos]===index,want=passes(index)&&directoryMatches43(state.files[index]);
      if(has&&!want)ids.splice(pos,1);else if(!has&&want)ids.splice(pos,0,index);
    }
    function addBlock(kind,group,ids){var n=ids?ids.length:1;if(!n)return;var block={kind:kind,group:group,ids:ids,start:rowCount,end:rowCount+n};blocks.push(block);rowCount+=n;if(ids)group.photoBlock=block;}
    function rebuild(center){
      ensure();blocks=[];rowCount=0;matches=0;
      groups.forEach(function(l){
        var shown=[],lineMatches=0,lineOpen=directoryQuery43||!collapsedGroups.has(l.key);
        l.towers.forEach(function(t){
          t.photoBlock=null;var ids=visible(t),empty=!t.indices.length&&filterMode==='all'&&!directoryQuery43;
          if(!ids.length&&!empty)return;lineMatches+=ids.length;shown.push(t);
        });
        if(!shown.length)return;matches+=lineMatches;addBlock('line',l);
        if(lineOpen)shown.forEach(function(t){addBlock('tower',t);if(directoryQuery43||!collapsedTowers.has(t.key))addBlock('photos',t,visible(t));});
      });
      first=last=-1;render(true);searchStatus43(matches);FastIndex.paint();
      if(center)reveal(state.index,false);
    }
    function position(index){var t=photoGroup[index],block=t&&t.photoBlock;if(!block)return;var rank=lowerBound(block.ids,index);if(block.ids[rank]===index)return block.start+rank;}
    function at(pos){
      var a=0,b=blocks.length;while(a<b){var m=(a+b)>>>1;if(blocks[m].end<=pos)a=m+1;else b=m;}
      var block=blocks[a];if(!block)return;return block.ids?{kind:'photo',index:block.ids[pos-block.start]}:{kind:block.kind,group:block.group};
    }
    function stats(g){return FastIndex.groupStats(g.kind,g.key)||{total:g.indices.length,marked:0,viewed:0,towers:0,finished:0};}
    function rowHTML(r){
      if(r.kind==='photo'){
        var i=r.index,f=state.files[i],p=parseFilePrefixAndLocation(f.name,f.relPath),marked=state.markedFiles.has(f.id),review=reviewOf(f.id).status;
        var tags=marked?(state.markedDefectTags.get(f.id)||''):'',queued=photoPending48(f.id);
        return '<div class="loc-item'+(i===state.index?' current':'')+'" data-idx="'+i+'" role="treeitem" aria-level="3" aria-selected="'+(i===state.index)+'" title="'+esc(f.relPath||f.name)+'"><span class="loc-name">'+(i===state.index?'<span class="loc-current-arrow">▶</span>':'')+'<span class="photo-name-text" data-idx="'+i+'" data-loc="'+esc(p.loc)+'" data-raw-name="'+esc(f.name)+'">'+esc(p.loc)+(tags?'<span class="item-defect-tag">'+esc(tags)+'</span>':'')+'</span></span><span class="item-status-badges">'+(queued?'<span class="pending-badge48">待保存</span>':'')+(marked?'<span class="item-marked-tag">'+markBadgeText(f.id)+'</span>':'')+(viewedPhotosMap[f.id]?'<span class="item-viewed-tag">已看</span>':'')+(review!=='pending'?'<span class="item-review-tag">'+({clear:'无缺陷',defect:'有缺陷',review:'需复核',unusable:'不可用'}[review]||'')+'</span>':'')+(marked?'<button class="btn-cancel-marked-mini" type="button" data-idx="'+i+'" data-raw-name="'+esc(f.id)+'" title="撤回此照片的缺陷成果">×</button>':'')+'</span></div>';
      }
      var g=r.group,s=stats(g),line=r.kind==='line',closed=(line?collapsedGroups:collapsedTowers).has(g.key)&&!directoryQuery43;
      var current=photoGroup[state.index],isCurrent=current&&(line?current.line===g:current===g);
      var groupClass=(line?'prefix-group':'tower-group')+(isCurrent?(line?' current-group':' current-tower'):''),headClass=line?'prefix-header':'tower-header';
      var data=line?'data-prefix="'+esc(g.key)+'"':'data-tower-key="'+esc(g.key)+'"';
      var rename=line?'data-folder-type="line" data-line-name="'+esc(g.name)+'"':'data-folder-type="tower" data-prefix="'+esc(g.line.name)+'" data-tower-name="'+esc(g.name)+'"';
      return '<div class="'+groupClass+(closed?' collapsed':'')+'" '+data+'><div class="'+headClass+'" '+data+' data-first-idx="'+(g.indices[0]===undefined?-1:g.indices[0])+'" role="treeitem" aria-level="'+(line?1:2)+'" aria-expanded="'+!closed+'"><span class="folder-label48"><span class="folder-chevron48">'+(closed?'›':'⌄')+'</span><span class="folder-name-text '+(line?'folder-line-name':'folder-tower-name')+'" '+rename+'>'+esc(g.name)+'</span></span><span class="folder-meta48"><span class="'+(line?'line-marked-badge':'tower-marked-badge')+'">'+(s.marked?'已标 '+s.marked+'/'+s.total:s.total+' 张')+'</span><span class="'+(line?'line-viewed-badge':'tower-viewed-badge')+'">'+(line?'已看 '+s.finished+'/'+s.towers+'基':'已看 '+s.viewed+'/'+s.total)+'</span>'+folderViewedControl39(line?'line':'tower',g.key,s.total)+'</span></div></div>';
    }
    function padding(){return Math.max(0,(pathTree.clientHeight||480)/2-rowHeight/2);}
    function render(force){
      var pad=padding(),height=pathTree.clientHeight||480;
      var start=Math.max(0,Math.floor((pathTree.scrollTop-pad)/rowHeight)-overscan),end=Math.min(rowCount,start+Math.ceil(height/rowHeight)+overscan*2);
      if(!force&&first===start&&last===end)return;
      // Never destroy a live rename input merely because the user scrolls.
      if(pathTree.querySelector('.rename-folder-input,.rename-photo-input'))return;
      first=start;last=end;
      if(!container||!container.isConnected){pathTree.innerHTML='<div class="virtual-space48"><div class="virtual-rows48"></div></div>';container=pathTree.firstElementChild;}
      container.style.height=Math.max(height,pad*2+rowCount*rowHeight)+'px';
      var rows=container.firstElementChild;rows.style.transform='translateY('+(pad+start*rowHeight)+'px)';
      var html=[];for(var n=start;n<end;n++)html.push('<div class="virtual-row48">'+rowHTML(at(n))+'</div>');rows.innerHTML=html.join('');
      if(!rowCount)rows.innerHTML='<div class="tree-empty48">'+(state.files.length?'没有符合筛选条件的照片':'请选择输入目录')+'</div>';
      indexTreeRows();pathTree.classList.remove('tree-centered44');if(typeof Motion!=='undefined')Motion.select(false);
    }
    function reveal(index,animate){
      var pos=position(index);if(pos===undefined)return;
      var target=pos*rowHeight,from=pathTree.scrollTop;
      if(scrollFrame)cancelAnimationFrame(scrollFrame);
      if(!animate||Math.abs(target-from)>(pathTree.clientHeight||480)*2||window.matchMedia('(prefers-reduced-motion: reduce)').matches){pathTree.scrollTop=target;render(true);return;}
      var start=performance.now();
      function step(now){var t=Math.min(1,(now-start)/110);pathTree.scrollTop=from+(target-from)*(1-Math.pow(1-t,3));render();if(t<1)scrollFrame=requestAnimationFrame(step);else{scrollFrame=0;render(true);Motion.select(true);}}
      scrollFrame=requestAnimationFrame(step);
    }
    function select(index,scroll){
      ensure();var t=photoGroup[index],old=photoGroup[lastCurrent],changed=false;
      if(t&&old&&old!==t){collapsedTowers.add(old.key);if(old.line!==t.line)collapsedGroups.add(old.line.key);changed=true;}
      if(t){if(collapsedTowers.delete(t.key))changed=true;if(collapsedGroups.delete(t.line.key))changed=true;}
      if(filterMode==='unviewed'){dirty(lastCurrent);dirty(index);}
      lastCurrent=index;
      if(changed||position(index)===undefined||filterMode==='unviewed')rebuild(false);else render(true);
      if(scroll)reveal(index,true);searchStatus43(matches);
    }
    function expandAll(){ensure();collapsedGroups.clear();collapsedTowers.clear();rebuild(false);}
    function collapseAll(){ensure();groups.forEach(function(l){collapsedGroups.add(l.key);});rebuild(false);}
    pathTree.addEventListener('scroll',function(){if(frame)return;frame=requestAnimationFrame(function(){frame=0;render();});},{passive:true});
    pathTree.addEventListener('wheel',function(){if(scrollFrame)cancelAnimationFrame(scrollFrame);scrollFrame=0;},{passive:true});
    window.addEventListener('resize',function(){render(true);});
    return {invalidate:invalidate,rebuild:rebuild,render:render,select:select,reveal:reveal,expandAll:expandAll,collapseAll:collapseAll,
      dirty:dirty,firstMatch:function(){var block=blocks.find(function(b){return b.ids;});if(block)return {kind:'photo',index:block.ids[0]};},metrics:function(){return {rows:rowCount,matches:matches,domRows:last-first};}};
  })();


  $('queuePanel48').addEventListener('toggle',function(){SaveQueue48.paint();});
  $('saveJobs48').addEventListener('click',function(e){var retry=e.target.closest('[data-retry48]'),dismiss=e.target.closest('[data-dismiss48]');if(retry)SaveQueue48.retry(Number(retry.dataset.retry48));if(dismiss)SaveQueue48.dismiss(Number(dismiss.dataset.dismiss48));});
  $('retryRecords48').addEventListener('click',async function(){await flushViewed48();for(var row of Array.from(recordFailures46.values()))await queueRecord46(row.namespace,row.id,row.value);SaveQueue48.paint();});
  $('btnFocus48').addEventListener('click',function(){var on=document.body.classList.toggle('focus48');this.setAttribute('aria-pressed',String(on));this.textContent=on?'返回工作台':'专注查看';requestAnimationFrame(function(){if(currentImage()){var f=computeFit(state.natural.w,state.natural.h);fitView(f.w,f.h,f.s);render();}VirtualTree48.render(true);});});
  btnClearViewedSettings.addEventListener('click',function(){withIO(async function(){await viewedReady48;if(!await showConfirmDialog('清空已看记录','将清空全部已看标记，照片、缺陷成果及检查结论保持不变。'))return;if(!await flushViewed48())throw new Error('请先重试保存记录');await recordBatch46('viewed:global',Object.keys(viewedPhotosMap).map(function(id){return [id,undefined];}));viewedPhotosMap=Object.create(null);viewedDirty48.clear();FastIndex.invalidate();VirtualTree48.rebuild(false);updateHud();toast('已清空已看标记');});});

  /* ================= 初始化 ================= */
  Motion.init();

  loadPersisted();
  initResizers();
  applyTheme();
  updateHud();
  initNotice();
  // Folder-level viewed state is independent of inspection decisions and saved defects.
  var preserveTreeExpansion39 = false;
  function folderViewedControl39(kind, key, total) {
    if (!total) return '';
    return '<select class="folder-view-action" data-scope-kind="'+kind+'" data-scope-key="'+esc(key)+'" aria-label="'+esc(key)+' 批量查看状态" title="应用到此分组全部 '+total+' 张照片（含筛选隐藏项）；不更改检查结论"><option value="">批量标记</option><option value="seen">全部设为已看</option><option value="unseen">全部设为未看</option></select>';
  }
  async function commitFolderViewed39(kind,key,seen){
    if(kind!=='line'&&kind!=='tower')throw new Error('无效的分组');
    await viewedReady48;if(!await flushViewed48())throw new Error('请先重试保存已看记录');
    var changes=[],matched=0;
    state.files.forEach(function(f){var p=parseFilePrefixAndLocation(f.name,f.relPath);
      if((kind==='line'?p.prefix:p.prefix+':::'+p.tower)!==key)return;matched++;
      if(!!viewedPhotosMap[f.id]!==seen)changes.push([f.id,seen?true:undefined]);
    });
    await recordBatch46('viewed:global',changes);
    changes.forEach(function(r){if(r[1])viewedPhotosMap[r[0]]=true;else delete viewedPhotosMap[r[0]];});
    FastIndex.invalidate();return {matched:matched,changed:changes.length};
  }

  function markFolderViewed39(kind,key,seen) {
    return withIO(async function() {
      var result = await commitFolderViewed39(kind,key,seen);
      var scroll = pathTree.scrollTop;
      preserveTreeExpansion39 = true;
      try { renderPathTree(false); } finally { preserveTreeExpansion39 = false; }
      pathTree.scrollTop = scroll; FastIndex.paint(); updateHud();
      toast(result.matched ? '已将 '+result.matched+' 张照片设为'+(seen?'已看':'未看')+'（检查结论不变）' : '此分组没有可标记的照片');
      return result;
    });
  }
  ['click','dblclick','pointerdown','keydown'].forEach(function(type) {
    pathTree.addEventListener(type,function(e) { if(e.target.closest('.folder-view-action')) e.stopPropagation(); },true);
  });
  pathTree.addEventListener('change',function(e) {
    var el=e.target.closest('.folder-view-action');if(!el || !el.value)return;
    var seen=el.value==='seen';el.value='';markFolderViewed39(el.dataset.scopeKind,el.dataset.scopeKey,seen);
  });

  function clampFloating39(x,y,w,h,vw,vh) {
    return {x:Math.max(8,Math.min(x,Math.max(8,vw-w-8))),y:Math.max(8,Math.min(y,Math.max(8,vh-h-8)))};
  }
  function initFloating39() {
    var el=btnBackToCurrent,key='xunjian_back_position_v1',pos={x:150,y:innerHeight-60},norm=null,drag=null,raf=0,suppressUntil=0;
    document.body.appendChild(el);el.classList.add('draggable-back');
    el.title='单击定位最后一个已看；拖动调整位置；聚焦后 Alt+方向键微调';
    try { var saved=JSON.parse(localStorage.getItem(key));if(saved && Number.isFinite(saved.x)&&Number.isFinite(saved.y))norm=saved; }catch(e){}
    function bounds(x,y) {return clampFloating39(x,y,el.offsetWidth||160,el.offsetHeight||36,innerWidth,innerHeight);}
    function paint(){raf=0;el.style.transform='translate3d('+pos.x+'px,'+pos.y+'px,0)';}
    function place(){pos=bounds(norm?norm.x*innerWidth:150,norm?norm.y*innerHeight:innerHeight-60);paint();}
    function save(){norm={x:pos.x/innerWidth,y:pos.y/innerHeight};try{localStorage.setItem(key,JSON.stringify(norm));}catch(e){toast('位置已调整，但无法保存位置');}}
    function finish(e,cancel) {
      if(!drag || e.pointerId!==drag.id)return;
      var old=drag;drag=null;
      if(old.moved){suppressUntil=performance.now()+500;if(cancel)pos=old.start;else save();}
      if(raf)cancelAnimationFrame(raf);raf=0;paint();el.classList.remove('dragging');
      if(el.hasPointerCapture(old.id))el.releasePointerCapture(old.id);
    }
    el.addEventListener('pointerdown',function(e){if(e.button!==0 || drag)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,start:{x:pos.x,y:pos.y},moved:false};el.setPointerCapture(e.pointerId);e.stopPropagation();});
    el.addEventListener('pointermove',function(e){if(!drag || e.pointerId!==drag.id)return;var dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved && Math.hypot(dx,dy)<5)return;drag.moved=true;el.classList.add('dragging');pos=bounds(drag.start.x+dx,drag.start.y+dy);if(!raf)raf=requestAnimationFrame(paint);e.preventDefault();});
    el.addEventListener('pointerup',function(e){finish(e,false);});
    el.addEventListener('pointercancel',function(e){finish(e,true);});
    el.addEventListener('lostpointercapture',function(e){finish(e,true);});
    el.addEventListener('click',function(e){if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
    el.addEventListener('keydown',function(e){if(!e.altKey || !/^Arrow/.test(e.key))return;e.preventDefault();e.stopPropagation();var d=e.shiftKey?30:10;pos=bounds(pos.x+(e.key==='ArrowRight'?d:e.key==='ArrowLeft'?-d:0),pos.y+(e.key==='ArrowDown'?d:e.key==='ArrowUp'?-d:0));paint();save();});
    window.addEventListener('resize',place);
    $('btnResetBackPosition').addEventListener('click',function(){norm=null;place();save();toast('定位按钮位置已恢复');});place();
  }
  function toggleSettings39(force) {
    var open=typeof force==='boolean'?force:!settingsPanel.classList.contains('show');
    settingsPanel.inert=!open;settingsPanel.classList.toggle('show',open);$('settingsBackdrop').classList.toggle('show',open);btnSettings.setAttribute('aria-expanded',String(open));
    if(open)$('btnCloseSettings').focus();else btnSettings.focus();
  }
  function initLayout39() {
    $('btnCloseSettings').addEventListener('click',function(){toggleSettings39(false);});
    $('settingsBackdrop').addEventListener('click',function(){toggleSettings39(false);});
    // Existing template/rule actions close the panel directly; keep the scrim in sync.
    if(window.MutationObserver)new MutationObserver(function(){var open=settingsPanel.classList.contains('show');$('settingsBackdrop').classList.toggle('show',open);btnSettings.setAttribute('aria-expanded',String(open));}).observe(settingsPanel,{attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',function(e){
      if(!settingsPanel.classList.contains('show') || document.querySelector('.overlay.show'))return;
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();toggleSettings39(false);return;}
      if(e.key==='Tab'){
        var all=Array.from(settingsPanel.querySelectorAll('button,input,select,[tabindex="0"]')).filter(function(n){return !n.disabled && n.offsetParent!==null;});
        var first=all[0],last=all[all.length-1];
        if((e.shiftKey && document.activeElement===first)||(!e.shiftKey && document.activeElement===last)){e.preventDefault();(e.shiftKey?last:first).focus();}
      }
    },true);
    initFloating39();
  }

  $('btnCleanOutputNames').addEventListener('click',function(){toggleSettings39(false);cleanOutputNames42();});
  $('insulationTerms').value=insulationTerms42().join('，');
  $('btnSaveInsulationTerms').addEventListener('click',function(){var terms=$('insulationTerms').value.split(/[,，;；\n]+/).map(function(x){return x.trim();}).filter(Boolean);if(!terms.length){toast('请至少填写一个关键词');return;}try{localStorage.setItem('xunjian_insulation_terms_v1',JSON.stringify(Array.from(new Set(terms))));toast('分类关键词已保存');}catch(e){toast('关键词保存失败：'+e.message);}});
  var directoryQuery43='',directoryTerms43=[],directoryCache43=new WeakMap(),directoryTimer43=null,directoryComposing43=false,directorySnapshot43=null;
  function normalizeDirectory43(value){return String(value||'').normalize('NFKC').toLocaleLowerCase().trim();}
  function directoryMatches43(f){
    if(!directoryTerms43.length)return true;if(!f)return false;
    var cached=directoryCache43.get(f),p=parseFilePrefixAndLocation(f.name,f.relPath);
    var signature=[f.name,f.relPath,p.prefix,p.tower,p.loc].join('\n');
    if(!cached||cached.signature!==signature){cached={signature:signature,text:normalizeDirectory43(signature)};directoryCache43.set(f,cached);}
    return directoryTerms43.every(function(term){return cached.text.includes(term);});
  }
  function searchStatus43(count){
    var el=$('directorySearchStatus');if(!el)return;
    el.hidden=!directoryQuery43;
    if(directoryQuery43)el.textContent='当前筛选下 '+count+' 张匹配照片'+(state.index>=0&&!directoryMatches43(state.files[state.index])?' · 当前图片不在搜索结果中':'');
  }
  function setDirectoryQuery43(value){
    var next=normalizeDirectory43(value);if(next===directoryQuery43)return;
    if(next&&!directoryQuery43)directorySnapshot43={groups:new Set(collapsedGroups),towers:new Set(collapsedTowers),scroll:pathTree.scrollTop};
    directoryQuery43=next;directoryTerms43=next.split(/\s+/).filter(Boolean);
    var snapshot=directorySnapshot43;
    if(!next&&snapshot){collapsedGroups.clear();snapshot.groups.forEach(function(x){collapsedGroups.add(x);});collapsedTowers.clear();snapshot.towers.forEach(function(x){collapsedTowers.add(x);});directorySnapshot43=null;}
    var old=preserveTreeExpansion39;preserveTreeExpansion39=true;
    try{renderPathTree(false);}finally{preserveTreeExpansion39=old;}
    if(!next&&snapshot)pathTree.scrollTop=snapshot.scroll;else pathTree.scrollTop=0;
    $('btnClearDirectorySearch').hidden=!next;
    if(!next)Motion.select(false);
  }
  function updateCompactPhoto43(){var f=state.files[state.index],el=$('compactPhotoName');if(!el)return;el.textContent=f?f.name:'未打开图片';el.title=f?(f.relPath||f.name):'';}
  function initSidebar43(){
    var input=$('directorySearch');
    function apply(){clearTimeout(directoryTimer43);directoryTimer43=null;setDirectoryQuery43(input.value);}
    input.addEventListener('input',function(){clearTimeout(directoryTimer43);if(!directoryComposing43)directoryTimer43=setTimeout(apply,160);});
    input.addEventListener('compositionstart',function(){directoryComposing43=true;clearTimeout(directoryTimer43);});
    input.addEventListener('compositionend',function(){directoryComposing43=false;apply();});
    input.addEventListener('keydown',function(e){if(e.isComposing)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();input.value='';apply();}else if(e.key==='Enter'){e.preventDefault();apply();var row=VirtualTree48.firstMatch();if(row)switchTo(row.index);}});
    $('btnClearDirectorySearch').addEventListener('click',function(){input.value='';apply();input.focus();});
    var details=$('currentPhotoDetails');try{details.open=localStorage.getItem('xunjian_compact_details_v1')==='open';}catch(e){}
    details.addEventListener('toggle',function(){try{localStorage.setItem('xunjian_compact_details_v1',details.open?'open':'closed');}catch(e){}});
  }

  var centerResizeFrame44=0;
  function refreshCenterSpace44(){
    if(centerResizeFrame44)return;
    centerResizeFrame44=requestAnimationFrame(function(){centerResizeFrame44=0;VirtualTree48.render(true);VirtualTree48.reveal(state.index,false);});
  }
  if(window.ResizeObserver)new ResizeObserver(refreshCenterSpace44).observe(pathTree);
  window.addEventListener('resize',refreshCenterSpace44);refreshCenterSpace44();
  initSidebar43();
  initLayout39();
  XunjianAuth.isBusy=function(){return workspaceBusy52();};
  var directoryMemoryStarted50=false;
  function restoreOnLogin50(){
    if(!directoryMemoryStarted50&&XunjianAuth.current()){
      directoryMemoryStarted50=true;
      initDirectoryMemory();
    }
  }
  XunjianAuth.ready.then(restoreOnLogin50);
  window.addEventListener('xunjian-auth-changed',restoreOnLogin50);

  var draftTimer50=null,draftChain50=Promise.resolve(),draftSignatures50=new Map(),draftError50=null;
  function scheduleDrafts50(){clearTimeout(draftTimer50);draftTimer50=setTimeout(function(){saveDrafts50().catch(function(e){toast('草稿保存失败：'+e.message,6000);});},450);}
  async function saveDrafts50(){
    clearTimeout(draftTimer50);if(!projectId)return;var namespace='draft50:'+projectId,rows=[];
    for(var pair of state.meta){var id=pair[0],meta=pair[1],cache=state.cache.get(id);
      var value=JSON.parse(JSON.stringify(meta));if(cache)value.desktopBakedCount50=cache.bakedCount||0;
      var signature=JSON.stringify(value);if(draftSignatures50.get(id)!==signature)rows.push([id,value,signature]);
    }
    var signatures=draftSignatures50;
    draftChain50=draftChain50.catch(function(){}).then(async function(){if(rows.length)await recordBatch46(namespace,rows.map(function(r){return [r[0],r[1]];}));rows.forEach(function(r){signatures.set(r[0],r[2]);});draftError50=null;});
    try{await draftChain50;}catch(e){draftError50=e;throw e;}
  }
  async function restoreDrafts50(){
    draftSignatures50=new Map();var drafts=await readRecords46('draft50:'+projectId),count=0;
    Object.keys(drafts).forEach(function(id){var m=drafts[id];if(state.byName.has(id)&&Array.isArray(m.boxes)&&Array.isArray(m.appended)){state.meta.set(id,m);draftSignatures50.set(id,JSON.stringify(m));if(!m.saved&&(m.boxes.length||m.appended.length))count++;}});
    if(count)setTimeout(function(){toast('已恢复 '+count+' 张照片的未导出草稿',6500);},800);
  }
  // Desktop lifecycle: finish queued disk writes and IndexedDB commits before closing.

  // Desktop synchronization updates the model, never reloads the renderer or discards drafts.
  var snapshotSignatures52=new Map(),inputSnapshot52=null;
  function outputGroupKey52(r){return r.pairId?'pair:'+r.pairId:'legacy:'+normOutput51(r.path.split('/').pop());}
  function hasDraft52(id){var m=state.meta.get(id);return !!m&&!m.saved&&(m.boxes.length||m.appended.length||m.isSecondaryEdit);}
  function recordOperation52(action,name,status,count,error){if(window.DesktopFS)DesktopFS.call('record-operation',{action:action,name:name,status:status,count:count,error:error}).catch(function(e){toast('操作已完成，但操作记录未保存：'+e.message,6000);});}
  function roots52(){return {input:lastInputHandle,output:output.mainHandle};}
  function workspaceBusy52(){return ioBusy||state.navBusy||saveQueueBusy48()||!!outputScanTask46||navigationPrompt||mode!=='idle'||!!draggedItem;}
  async function desktopExclusive52(job){
    if(workspaceBusy52())throw new Error('请等待当前保存或切换完成后重试');
    ioBusy=true;document.body.classList.add('io-busy');
    try{return await job();}finally{ioBusy=false;document.body.classList.remove('io-busy');loadingEl.style.display='none';updateReviewUI();SaveQueue48.paint();SaveQueue48.pump();pumpDecode();}
  }
  async function repaintCurrent52(forceClean,refit){
    if(state.index<0||!state.files[state.index]){state.index=-1;state.natural={w:0,h:0};render();renderSide();updateHud();empty.style.display='';viewerBottomBar.style.display='none';return;}
    empty.style.display='none';viewerBottomBar.style.display='flex';
    var oldNatural=state.natural,c=await getImage(state.index,forceClean||hasDraft52(curName()));state.natural={w:c.img.naturalWidth,h:c.img.naturalHeight};
    if(refit||oldNatural.w!==state.natural.w||oldNatural.h!==state.natural.h){var fit=computeFit(state.natural.w,state.natural.h);fitView(fit.w,fit.h,fit.s);}
    if(!viewedPhotosMap[curName()]){FastIndex.viewed(state.index);saveViewedPhotos();}
    render();renderSide();updateHud();updatePathTreeSelection(state.index,false);
  }
  async function listOutputGroups52(id){
    if(!id||!output.mainHandle)return [];
    return outputLock(output.mainHandle,async function(){
      var linked=await reconcileOutputs51(output.mainHandle,await rawReadOutputIndex42(output.mainHandle)),groups=new Map();
      linked.found.forEach(function(item){var r=item.record;if(r.photoId!==id)return;var key=outputGroupKey52(r),g=groups.get(key);if(!g){g={key:key,label:r.tag||r.path.split('/').pop(),paths:[],preview:null};groups.set(key,g);}g.paths.push(r.dir+'/'+r.path);if(!g.preview||r.dir===DIR_BOX)g.preview=item.handle;});
      return Array.from(groups.values()).map(function(g){g.paths.sort();return g;});
    });
  }
  async function deleteOutputGroup52(id,key,expectedPaths){return desktopExclusive52(async function(){
    var groups=await listOutputGroups52(id),group=groups.find(function(g){return g.key===key;});
    if(!group||JSON.stringify(group.paths)!==JSON.stringify(expectedPaths))throw new Error('成果已变化，请重新打开成果列表');
    var count=await deleteExistingDefectOutputs(id,null,key),m=getMeta(id);
    if(m.saved){m.boxes=[];m.appended=[];m.history=[];m.desktopBakedCount50=0;m.saved=false;m.tagsCleared=false;}
    dropImage(id);await scanOutputDirectory({quiet:true,noReselect:true});await saveDrafts50();
    if(curName()===id)await repaintCurrent52(false,false);
    toast('已移入成果回收站，可随时恢复');return {count:count};
  });}
  async function restoreOutput52(id){return desktopExclusive52(async function(){
    if(!output.mainHandle)throw new Error('请先选择输出目录');
    var result=await outputLock(output.mainHandle,function(){return DesktopFS.call('trash-restore',{h:output.mainHandle,id:id});});
    legacyCache46.delete(output.mainHandle);await scanOutputDirectory({quiet:true,noReselect:true});if(curName())dropImage(curName());await repaintCurrent52(false,false);return result;
  });}
  async function refreshWorkspace52(force){
    if(workspaceBusy52())return {busy:true};
    if(!lastInputHandle&&!output.mainHandle)return {empty:true};
    return desktopExclusive52(async function(){
      await saveDrafts50();var current=curName(),oldIndex=state.index,changed=false,removedDraft=false,selectionChanged=false;
      if(lastInputHandle&&state.mode==='fs'){
        var snap=await DesktopFS.call('snapshot',{h:lastInputHandle,mode:'input'}),key='input:'+lastInputHandle.root+':'+lastInputHandle.rel;
        if(force||snapshotSignatures52.get(key)!==snap.signature){
          var oldRows=new Map((inputSnapshot52&&inputSnapshot52.key===key?inputSnapshot52.rows:[]).map(function(r){return [r.path,JSON.stringify([r.size,r.mtime,r.ctime])];}));
          var entries=snap.rows.map(function(r){return {id:photoPaths[r.path],name:r.name,handle:DesktopFS.revive(r.handle),file:null,mime:mimeOf(r.name),relPath:r.path,group:extractGroup(r.name)};});
          await assignPhotoIdentities(entries,lastInputHandle);await sortPhotos48(entries);
          if(entries.some(function(f){return !state.meta.has(f.id);})){var savedDrafts=await readRecords46('draft50:'+projectId);entries.forEach(function(f){var m=savedDrafts[f.id];if(!state.meta.has(f.id)&&m&&Array.isArray(m.boxes)&&Array.isArray(m.appended))state.meta.set(f.id,m);});}
          var newIds=new Set(entries.map(function(f){return f.id;}));
          state.files.forEach(function(f){if(!newIds.has(f.id)){if(hasDraft52(f.id))removedDraft=true;dropImage(f.id);}});
          snap.rows.forEach(function(r){var id=photoPaths[r.path];if(force||oldRows.get(r.path)!==JSON.stringify([r.size,r.mtime,r.ctime]))dropImage(id);});
          state.files=entries;state.byName=new Map(entries.map(function(f){return [f.id,f];}));state.indexByName=new Map(entries.map(function(f,i){return [f.id,i];}));
          state.discoveredDirs=snap.dirs.map(function(d){return d.path;});dirRegistry.clear();dirRegistry.set('',{handle:lastInputHandle,parentHandle:null,name:lastInputHandle.name});
          snap.dirs.forEach(function(d){dirRegistry.set(d.path,{handle:DesktopFS.revive(d.handle),parentHandle:DesktopFS.revive(d.parent),name:d.handle.name});});
          state.index=state.indexByName.has(current)?state.indexByName.get(current):Math.min(Math.max(oldIndex,0),entries.length-1);selectionChanged=current!==curName();
          inputSnapshot52={key:key,rows:snap.rows};snapshotSignatures52.set(key,snap.signature);parsedFileCache.clear();directoryCache43=new WeakMap();directorySnapshot43=null;FastIndex.invalidate();VirtualTree48.invalidate();changed=true;
        }
      }
      if(output.mainHandle){
        var out=await DesktopFS.call('snapshot',{h:output.mainHandle,mode:'output'}),key='output:'+output.mainHandle.root+':'+output.mainHandle.rel;
        if(force||changed||snapshotSignatures52.get(key)!==out.signature){
          // A same-name image can have changed contents. Invalidate all output-backed previews.
          for(var pair of state.cache)if(pair[1].isBoxed)dropImage(pair[0]);
          legacyCache46.delete(output.mainHandle);await scanOutputDirectory({quiet:true,noReselect:true});snapshotSignatures52.set(key,out.signature);changed=true;
        }
      }
      if(changed){FastIndex.invalidate();renderPathTree(false);await repaintCurrent52(false,selectionChanged);}
      if(removedDraft)toast('原图已在文件夹中删除；未保存草稿仍已保留，放回同路径原图后可继续编辑',7500);
      return {changed:changed,photos:state.files.length};
    });
  }
  window.XunjianDesktop={
    roots:roots52,
    currentId:curName,
    busy:workspaceBusy52,
    refresh:refreshWorkspace52,
    listOutputGroups:listOutputGroups52,
    deleteOutputGroup:deleteOutputGroup52,
    restoreOutput:restoreOutput52,
    listTrash:function(){if(!output.mainHandle)return Promise.resolve([]);return outputLock(output.mainHandle,function(){return DesktopFS.call('trash-list',{h:output.mainHandle});});},

    currentHandle:function(){return state.files[state.index]?.handle||lastInputHandle;},
    notify:toast,
    diagnostics:function(){return {photos:state.files.length,queue:SaveQueue48.stats(),pendingRecords:recordPending46,failedRecords:recordFailures46.size,cacheEntries:state.cache.size};},
    prepareClose:async function(){
      var until=Date.now()+35000;
      while(ioBusy||state.navBusy||outputScanTask46||saveQueueBusy48()||recordPending46){if(Date.now()>until)return {ok:false,message:'保存任务仍在进行，请稍后再关闭。'};await new Promise(function(r){setTimeout(r,100);});}
      await viewedReady48;await flushViewed48();await saveDrafts50();
      for(var row of Array.from(recordFailures46.values()))await queueRecord46(row.namespace,row.id,row.value);
      while(recordPending46){if(Date.now()>until)return {ok:false,message:'记录尚未保存完成。'};await new Promise(function(r){setTimeout(r,50);});}
      if(SaveQueue48.stats().failed||viewedDirty48.size||recordFailures46.size)return {ok:false,message:'有保存失败的任务，请在保存任务面板中重试后关闭。'};
      return {ok:true};
    }
  };
})();
