package com.torhang.labelimg.common.util;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

public final class AesCrypto {

    private static final String ALGORITHM = "AES/CBC/PKCS5Padding";
    private static final int IV_LEN = 16;

    private AesCrypto() {}

    /** keyBytes 必须 16/24/32 字节 */
    public static String encrypt(String plain, byte[] keyBytes) {
        try {
            byte[] iv = new byte[IV_LEN];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "AES"), new IvParameterSpec(iv));
            byte[] cipherBytes = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            // IV || 密文，一起 Base64
            byte[] out = new byte[IV_LEN + cipherBytes.length];
            System.arraycopy(iv, 0, out, 0, IV_LEN);
            System.arraycopy(cipherBytes, 0, out, IV_LEN, cipherBytes.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("加密失败", e);
        }
    }

    public static String decrypt(String cipherBase64, byte[] keyBytes) {
        try {
            byte[] data = Base64.getDecoder().decode(cipherBase64);
            if (data.length <= IV_LEN) {
                throw new IllegalArgumentException("密文长度非法");
            }
            byte[] iv = new byte[IV_LEN];
            byte[] cipherBytes = new byte[data.length - IV_LEN];
            System.arraycopy(data, 0, iv, 0, IV_LEN);
            System.arraycopy(data, IV_LEN, cipherBytes, 0, cipherBytes.length);
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(keyBytes, "AES"), new IvParameterSpec(iv));
            return new String(cipher.doFinal(cipherBytes), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalArgumentException("解密失败，请检查密钥与密文", e);
        }
    }
}
