import sqlite3

conn = sqlite3.connect("easy.db")
cur = conn.cursor()
cur.execute("SELECT id, email, username, is_verified FROM users;")
for row in cur.fetchall():
    print(row)
conn.close()
