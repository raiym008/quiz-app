import sqlite3

DB_PATH = "easy.db"  # дерекқор файлының жолы

def delete_user_by_username(username: str):
    """Username арқылы пайдаланушыны өшіру"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Пайдаланушы бар ма, тексеру
    cursor.execute("SELECT id, email FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    if not user:
        print(f"❌ '{username}' атты пайдаланушы табылмады.")
        conn.close()
        return

    # Өшіруді растау
    print(f"Пайдаланушы табылды: {user}")
    confirm = input("Осы пайдаланушыны өшіруді қалайсыз ба? (y/n): ").strip().lower()
    if confirm != "y":
        print("Болдырылмады ❎")
        conn.close()
        return

    # Жою
    cursor.execute("DELETE FROM users WHERE username = ?", (username,))
    conn.commit()
    print(f"✅ '{username}' пайдаланушысы сәтті өшірілді.")

    conn.close()


def delete_user_by_email(email: str):
    """Email арқылы пайдаланушыны өшіру"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT id, username FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    if not user:
        print(f"❌ '{email}' поштасы табылмады.")
        conn.close()
        return

    print(f"Пайдаланушы табылды: {user}")
    confirm = input("Осы пайдаланушыны өшіруді қалайсыз ба? (y/n): ").strip().lower()
    if confirm != "y":
        print("Болдырылмады ❎")
        conn.close()
        return

    cursor.execute("DELETE FROM users WHERE email = ?", (email,))
    conn.commit()
    print(f"✅ '{email}' поштасымен пайдаланушы сәтті өшірілді.")

    conn.close()


if __name__ == "__main__":
    print("🧹 Easy App — пайдаланушыны дерекқордан жою")
    print("1) Username арқылы")
    print("2) Email арқылы")
    choice = input("Таңдаңыз (1/2): ").strip()

    if choice == "1":
        username = input("Өшірілетін username енгізіңіз: ").strip()
        delete_user_by_username(username)
    elif choice == "2":
        email = input("Өшірілетін email енгізіңіз: ").strip()
        delete_user_by_email(email)
    else:
        print("Қате таңдау ❌")
