import sqlite3, json
con=sqlite3.connect('data/echo.db')
row=con.execute("SELECT data FROM saves WHERE slot='autosave'").fetchone()
j=json.loads(row[0])
state=j['state']
tick=j['tick']
print('tick', tick)
cits=state['citizens']
c=cits['c_009']
# relationships involving c_009
rels=state.get('relationships', {})
print('rels type', type(rels), len(rels) if isinstance(rels, dict) else type(rels))
if isinstance(rels, dict):
  mine=[(k,v) for k,v in rels.items() if 'c_009' in k]
  print('mine count', len(mine))
  for k,v in mine[:10]:
    print(k, json.dumps(v)[:500])
else:
  print(json.dumps(rels)[:2000])
# memories
mems=state.get('memories', {})
print('mems type', type(mems))
if isinstance(mems, dict):
  print('mem keys sample', list(mems.keys())[:5])
  # is it dict id->record?
  cnt=0
  for k,v in mems.items():
    if isinstance(v, dict) and v.get('citizenId')=='c_009':
      print(k, json.dumps(v)[:500])
      cnt+=1
      if cnt>5: break
  print('c_009 mem count', cnt)
elif isinstance(mems, list):
  mine=[m for m in mems if isinstance(m, dict) and m.get('citizenId')=='c_009']
  print('c_009 mems', len(mine))
  for m in mine[:5]:
    print(json.dumps(m)[:500])
# goals
goals=state.get('goals', {})
print('goals type', type(goals))
if isinstance(goals, dict):
  print(list(goals.keys())[:5])
  for k,v in goals.items():
    if isinstance(v, dict) and v.get('citizenId')=='c_009':
      print(k, json.dumps(v)[:500])
# events
evs=state.get('events', [])
print('events len', len(evs) if isinstance(evs, list) else type(evs))
if isinstance(evs, list) and evs:
  print(json.dumps(evs[-3:], indent=2)[:2000])
print('eventSeq', state.get('eventSeq'))
# citizen_mind table
print('mind rows', con.execute("SELECT count(*) FROM citizen_mind").fetchone())
print(con.execute("SELECT citizen_id FROM citizen_mind").fetchall()[:10])
print('memory rows', con.execute("SELECT count(*) FROM memory").fetchone())
print('belief rows', con.execute("SELECT count(*) FROM belief").fetchone())
