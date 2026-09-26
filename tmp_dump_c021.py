import sqlite3, json
con = sqlite3.connect('data/echo.db')
con.row_factory = sqlite3.Row
row = con.execute("select data from saves where slot='autosave'").fetchone()
root = json.loads(row['data'])
st = root.get('state', root)
print("keys", list(st.keys()))
c = st['citizens'].get('c_021')
print("CITIZEN", json.dumps(c)[:3000])
print("REL", json.dumps([r for r in st.get('relationships', {}).values() if r.get('aId') == 'c_021' or r.get('bId') == 'c_021'])[:1500])
print("MEM", json.dumps([m for m in st.get('memories', []) if m.get('citizenId') == 'c_021'][-6:])[:1800])
print("GOALS", json.dumps([g for g in st.get('goals', {}).values() if g.get('citizenId') == 'c_021'])[:800])
print("clock", json.dumps(root.get('tick') or st.get('clock')))
