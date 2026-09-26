import sqlite3, json
con=sqlite3.connect('data/echo.db')
cur=con.cursor()
cur.execute("SELECT data FROM saves WHERE slot='autosave'")
row=cur.fetchone()
data=json.loads(row[0])
s=data['state']
print('CLOCK', json.dumps(data.get('clock',{})))
mems=[m for m in s.get('memories',[]) if m.get('citizenId')=='c_034'][:8]
print('MEM c034', json.dumps(mems, indent=2))
rels=[r for r in s.get('relationships',{}).values() if r.get('aId')=='c_034' or r.get('bId')=='c_034'][:8]
print('RELS c034', json.dumps(rels, indent=2))
goals=[g for g in s.get('goals',{}).values() if g.get('citizenId')=='c_034'][:5]
print('GOALS', json.dumps(goals, indent=2))
print('IDS', list(s.get('citizens',{}).keys())[:50])
