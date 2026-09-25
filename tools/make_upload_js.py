#!/usr/bin/env python3
"""
Emit javascript_tool payloads that inject a local file into a page's
<input type=file> via DataTransfer, so React-based ATS forms register it.

LAST RESORT. Try in this order first: (1) stage the file into the session and
file_upload the staged path, (2) ask the user to click Attach. This route costs
roughly (file bytes x 1.33 / 4) tokens — ~20k for a typical 1-page PDF.

Usage:
  python3 make_upload_js.py <file> <css_selector_of_input> [chunk_bytes]

Selectors: Greenhouse "#resume" / "#cover_letter"; otherwise find the input[type=file] first.

IMPORTANT: writes payloads to ./upload_payload/*.js and prints ONLY a manifest.
Never cat the whole payload - read one chunk file at a time and paste it
straight into javascript_tool. Printing it twice doubles the token cost.
"""
import sys, base64, os, json, shutil

path  = sys.argv[1]
sel   = sys.argv[2]
chunk = int(sys.argv[3]) if len(sys.argv) > 3 else 30000

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'upload_payload')
shutil.rmtree(out, ignore_errors=True); os.makedirs(out)

data = open(path, 'rb').read()
b64  = base64.b64encode(data).decode()
name = os.path.basename(path)
mime = ('application/pdf' if name.lower().endswith('.pdf')
        else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        if name.lower().endswith('.docx') else 'application/octet-stream')

parts = [b64[i:i+chunk] for i in range(0, len(b64), chunk)]
for i, p in enumerate(parts):
    op = '=' if i == 0 else '+='
    open(f'{out}/{i+1:02d}_chunk.js', 'w').write(
        f"window.__u{op}{json.dumps(p)}; window.__u.length")

open(f'{out}/99_commit.js', 'w').write(f"""(()=>{{
const bin=atob(window.__u); const arr=new Uint8Array(bin.length);
for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
const f=new File([arr],{json.dumps(name)},{{type:{json.dumps(mime)}}});
const dt=new DataTransfer(); dt.items.add(f);
const el=document.querySelector({json.dumps(sel)});
el.files=dt.files;
el.dispatchEvent(new Event('input',{{bubbles:true}}));
el.dispatchEvent(new Event('change',{{bubbles:true}}));
delete window.__u;
return {{n:el.files.length,name:el.files[0]?.name,size:el.files[0]?.size}};
}})()""")

print(f"file      : {name}")
print(f"raw bytes : {len(data)}")
print(f"b64 bytes : {len(b64)}   (~{len(b64)//4} tokens, paid once if you read each chunk file directly)")
print(f"selector  : {sel}")
print(f"chunks    : {len(parts)}  ->  {out}/01_chunk.js .. {len(parts):02d}_chunk.js, then 99_commit.js")
print("verify    : commit call returns {n:1, name, size}; size must equal raw bytes")
