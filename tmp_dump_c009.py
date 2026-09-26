import sqlite3, os
db='data/echo.db'
print('exists', os.path.exists(db))
con=sqlite3.connect(db)
cur=con.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
print(cur.fetchall())
for tbl,_ in [(t[0],None) for t in []]: pass
# list tables content counts
tables=[r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
for t in tables:
  try:
    c=con.execute(f'SELECT count(*) FROM "{t}"').fetchone()
    print(t, c)
  except Exception as e:
    print(t, 'err', e)
