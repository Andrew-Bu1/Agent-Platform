from cryptography.fernet import Fernet


def encrypt(encryption_key: str, plaintext: str) -> str:
    return Fernet(encryption_key.encode()).encrypt(plaintext.encode()).decode()


def decrypt(encryption_key: str, ciphertext: str) -> str:
    return Fernet(encryption_key.encode()).decrypt(ciphertext.encode()).decode()
