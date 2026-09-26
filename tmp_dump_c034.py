import sqlite3, json
con=sqlite3.connect('data/echo.db')
cur=con.cursor()
cur.execute("SELECT data FROM saves WHERE slot='autosave'")
row=cur.fetchone()
data=json.loads(row[0])
state=data['state']
c=state['citizens'].get('c_034')
print(json.dumps(c, indent=2))
