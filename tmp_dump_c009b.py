import sqlite3, json
con=sqlite3.connect('data/echo.db')
print([r[0] for r in con.execute("SELECT slot FROM saves").fetchall()])
row=con.execute("SELECT data FROM saves ORDER BY updated_at DESC LIMIT 1").fetchone()
if row:
  d=row[0]
  print('data len', len(d))
  j=json.loads(d)
  print('keys', list(j.keys())[:20])
  state=j.get('state') or j
  print('state keys', list(state.keys())[:30] if isinstance(state, dict) else type(state))
  if isinstance(state, dict) and 'citizens' in state:
    cits=state['citizens']
    print('cits type', type(cits))
    if isinstance(cits, dict):
      print('n cits', len(cits))
      print('keys sample', list(cits.keys())[:10])
      c=cits.get('c_009')
      if c:
        print(json.dumps(c, indent=2)[:6000])
      else:
        # search by name Robert Dube
        for k,v in cits.items():
          if isinstance(v, dict) and v.get('firstName')=='Robert' and 'Dube' in str(v.get('lastName')):
            print('found', k, json.dumps(v, indent=2)[:6000])
            break
        else:
          print('not found Robert Dube, listing first 5')
          import itertools
          for k in list(cits.keys())[:5]:
            v=cits[k]
            print(k, v.get('firstName'), v.get('lastName'))
