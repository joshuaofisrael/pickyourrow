#!/usr/bin/env python3
"""Pick Your Row pre-publish legal hold gate (JI Ventures rule, Joshua 27 Oct 2026; /workspace/content-review/RULE.md).
Runs as the first step of `npm run build` (package.json), which GitHub Actions runs before deploy: any flagged item that is not approved or cleared fails the deploy.

Items checked: every entry in src/data/guides.json, news.json, airlines.json, aircraft.json (title, description, body,
notes, sources, every string) and the visible text of every src/pages/**/*.astro file.

Usage:
  legal_gate.py check [--no-queue] [--data DIR]     exit 0 = all pass, 3 = something is HOLD_REVIEW
  legal_gate.py item FILE.json                       check one draft item (a JSON object) exit 0 / 3
  legal_gate.py hold FILE.json "TITLE"               save draft as HOLD_REVIEW in drafts/pickyourrow + queue.jsonl
  legal_gate.py moderate FILE.json "rule + fix made" ["TITLE"]   independent ChatGPT review (MODERATE only)

SEVERITY (amendment 27 Oct 2026 18:25):
  HIGH = rules 1, 2, 6, 8 -> HOLD_REVIEW for Joshua only. Publishes only with a line in approvals.jsonl
         {"site":"pickyourrow.com","sha256":<exact item hash>,"approved_by":"Joshua ..."}. Never self cleared.
  MODERATE = rules 3, 4, 5, 7 -> bot fixes. Objective detectors (3 remote image without licence, 4 guide/news with no
         source URL) must stop firing; keyword tripwires (5, 7) left after a fix go to chatgpt_review.py; SAFE logs a
         clearance in moderate-clearances.jsonl tied to the sha256. Up to 3 rework rounds, then held for Joshua.
CODE ENFORCED: 2 (email/phone/street address outside legal pages), 3 (remote image URLs), 4 (sources required on
guides and news), 6 (election wording), 8 (embargo/notice wording + restrictions list), keyword tripwires for 1, 5, 7.
JUDGEMENT ONLY: accuracy of facts and sources, defamation nuance, misleading headlines."""
import sys,os,re,json,hashlib,datetime,glob,subprocess
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE="pickyourrow.com"; BOT="Pick Your Row SEO bot"
CR=os.environ.get("CONTENT_REVIEW_DIR","/workspace/content-review")
Q=CR+"/queue.jsonl"; AP=CR+"/approvals.jsonl"; MC=CR+"/moderate-clearances.jsonl"; DR=CR+"/drafts/pickyourrow"
REVIEW=CR+"/bin/chatgpt_review.py"
# repo copies so CI (no box access) honours approvals/clearances/restrictions for exact hashes
REPO_LISTS=os.path.join(ROOT,"legal")
HIGH={1,2,6,8}; OBJECTIVE={3,4}
LEGAL_PAGES=("privacy","terms","contact","disclaimer","disclosure","about")
EMAIL_OK=("@pickyourrow.com","joshuaofisrael@gmail.com")
KW={
 1:r"\b(fraud\w*|scam\w*|corrupt(ion|ly)?|embezzl\w*|arrested|indicted|charged with|convicted|lawsuits?|sued|suing|misconduct|abus(e|ed|ive)|dishonest\w*|cover[ -]?up|criminal|bribe\w*|negligen\w*|cheat(s|ed|ing)?|rip[ -]?off)\b",
 5:r"\b(guaranteed returns?|tax advice|legal advice|medical advice|you should (sue|claim compensation)|deep vein thrombosis treatment|take \d+ ?mg)\b",
 6:r"\b(election|ballot|polling (place|station)|voter registration|vote by|voting day|certified results?|electoral)\b",
 7:r"\b(official partner|endorsed by|in partnership with|certified by|approved by the|official seat map|100% (safe|accurate)|guaranteed (best|upgrade))\b",
 8:r"\b(embargo(ed)?|cease and desist|dmca|takedown notice|legal notice|reporting restriction|correction request)\b",
}
def sha(o): return hashlib.sha256(json.dumps(o,sort_keys=True,ensure_ascii=False).encode() if not isinstance(o,(bytes,str)) else (o.encode() if isinstance(o,str) else o)).hexdigest()
def strings(o):
    if isinstance(o,str): yield o
    elif isinstance(o,dict):
        for v in o.values(): yield from strings(v)
    elif isinstance(o,list):
        for v in o: yield from strings(v)
def lines(name):
    out=[]
    for p in (os.path.join(CR,name),os.path.join(REPO_LISTS,name)):
        if os.path.exists(p):
            for l in open(p):
                try: out.append(json.loads(l))
                except Exception: pass
    return out
def approved(h): return any(j.get("site")==SITE and j.get("sha256")==h and str(j.get("approved_by","")).lower().startswith("joshua") for j in lines("approvals.jsonl"))
def cleared(h): return any(j.get("site")==SITE and j.get("sha256")==h and str(j.get("chatgpt_verdict","")).upper().startswith("SAFE") for j in lines("moderate-clearances.jsonl"))
def restricted():
    r=[]
    for p in (os.path.join(CR,"restrictions-pickyourrow.txt"),os.path.join(REPO_LISTS,"restrictions-pickyourrow.txt")):
        if os.path.exists(p): r+= [l.strip() for l in open(p) if l.strip() and not l.startswith("#")]
    return r
def scan(text,kind,key,legal=False,need_sources=None):
    R=[]
    for n,rx in KW.items():
        for m in re.finditer(rx,text,re.I):
            # disclaimers such as "not medical advice" or "not endorsed by any airline" are protective, not risky
            if n in (5,7) and re.search(r"\b(not|never|no|nor|isn'?t|aren'?t|without)\b[^.]{0,30}$",text[max(0,m.start()-45):m.start()],re.I): continue
            R.append((n,m.group(0),"keyword tripwire; review")); break
    if not legal:
        m=next((m for m in re.finditer(r"[\w.+-]+@[\w-]+\.[a-z][\w.]+",text) if not m.group(0).lower().endswith(EMAIL_OK)),None)
        if m: R.append((2,m.group(0),"email address"))
        m=re.search(r"(?<![\w/.:-])(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\w-])",text)
        if m: R.append((2,m.group(0).strip(),"possible phone number"))
        m=re.search(r"\b\d{1,5}\s+[A-Z][a-z]+(\s[A-Z][a-z]+)*\s(Street|St|Road|Rd|Drive|Dr|Avenue|Ave|Lane|Ln|Court|Ct|Boulevard|Blvd)\b",text)
        if m: R.append((2,m.group(0),"possible street address"))
    for u in re.findall(r"https?://[^\s\"')]+\.(?:jpe?g|png|gif|webp|avif|mp4)\b",text,re.I):
        R.append((3,u,"remote image/video without licence record: self host an owned asset or drop it")); break
    if need_sources is not None and not [s for s in need_sources if isinstance(s,dict) and str(s.get("url","")).startswith("http")]:
        R.append((4,"(no source URLs)","guide/news item cites no source actually accessed"))
    for r in restricted():
        if r==key or r in key: R.append((8,r,"listed restriction/complaint"))
    return R
def sev(R): return "HIGH" if any(n in HIGH for n,_,_ in R) else ("MODERATE" if R else None)
def check_item(obj,kind,key):
    need=obj.get("sources",[]) if kind in ("guides","news") else None
    return scan("\n".join(strings({k:v for k,v in obj.items() if k!="sources"}))+"\n"+"\n".join(str(s.get("label","")) for s in (obj.get("sources") or []) if isinstance(s,dict)),kind,key,need_sources=need)
def astro_text(src):
    src=re.sub(r"^---.*?---","",src,count=1,flags=re.S)
    src=re.sub(r"<(script|style)[^>]*>.*?</\1>"," ",src,flags=re.S|re.I)
    src=re.sub(r"\{[^{}]*\}"," ",src); return re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",src))
def all_items(data=None):
    d=data or os.path.join(ROOT,"src/data")
    for kind in ("guides","news","airlines","aircraft"):
        p=os.path.join(d,kind+".json")
        if not os.path.exists(p): continue
        for o in json.load(open(p)):
            key=f"{kind}/{o.get('slug') or o.get('id') or o.get('name')}"
            yield key,kind,o,sha(o),check_item(o,kind,key)
    for p in sorted(glob.glob(os.path.join(ROOT,"src/pages/**/*.astro"),recursive=True)):
        rel=os.path.relpath(p,ROOT); raw=open(p,encoding="utf-8").read()
        legal=any(f"/pages/{x}/" in p for x in LEGAL_PAGES)
        yield rel,"page",None,sha(raw),scan(astro_text(raw),"page",rel,legal=legal)
def verdict(R,h):
    if not R: return "PASS"
    if approved(h): return "PASS (Joshua approved hash)"
    if sev(R)=="MODERATE" and not any(n in OBJECTIVE for n,_,_ in R) and cleared(h): return "PASS (MODERATE, ChatGPT cleared hash)"
    return "HOLD_REVIEW"
def queue(title,R,draft,h,sources=()):
    os.makedirs(CR,exist_ok=True)
    open(Q,"a").write(json.dumps({"ts":datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),"site":SITE,"bot":BOT,"title":title,
      "flagged":"; ".join(f"[{n}] {f}" for n,f,_ in R),"rule":sorted(set(n for n,_,_ in R)),"sources":list(sources)[:20],
      "suggestion":"; ".join(sorted(set(s for _,_,s in R))),"severity":sev(R),"draft_path":draft,"sha256":h,"status":"HOLD_REVIEW"},ensure_ascii=False)+"\n")
def srcs(o): return [s.get("url") for s in (o.get("sources") or []) if isinstance(s,dict) and s.get("url")]
def main(a):
    if a and a[0]=="check":
        noq="--no-queue" in a; data=a[a.index("--data")+1] if "--data" in a else None; bad=0; n=0
        for key,kind,o,h,R in all_items(data):
            n+=1; v=verdict(R,h)
            if v=="HOLD_REVIEW":
                bad+=1; print("HOLD_REVIEW",sev(R),key,"sha256",h[:12]); [print(f"  rule {r} [{'HIGH' if r in HIGH else 'MODERATE'}]: {f!r} {s}") for r,f,s in R]
                if not noq and o is not None:
                    os.makedirs(DR,exist_ok=True); dp=os.path.join(DR,key.replace("/","__")+".HOLD_REVIEW.json"); json.dump(o,open(dp,"w"),indent=1,ensure_ascii=False)
                    queue(o.get("title",key),R,dp,h,srcs(o))
            elif R: print(v,key)
        print(f"legal gate: {n} items checked, {bad} HOLD_REVIEW"); return 3 if bad else 0
    if a and a[0] in ("item","hold","moderate") and len(a)>=2:
        o=json.load(open(a[1])); h=sha(o); key="draft/"+str(o.get("slug","item")); kind="news" if "datePublished" in o else "guides"
        R=check_item(o,kind,key); title=o.get("title",key)
        if a[0]=="item":
            v=verdict(R,h); print(v,sev(R) or "",key,"sha256",h[:12]); [print(f"  rule {r}: {f!r} {s}") for r,f,s in R]; return 0 if v.startswith("PASS") else 3
        if a[0]=="hold":
            os.makedirs(DR,exist_ok=True); dp=os.path.join(DR,os.path.basename(a[1]).replace(".json",".HOLD_REVIEW.json"))
            json.dump(o,open(dp,"w"),indent=1,ensure_ascii=False); queue(a[2] if len(a)>2 else title,R or [(0,"manual","held by bot judgement")],dp,h,srcs(o))
            print("HOLD_REVIEW: NOT published. Draft:",dp); return 3
        if a[0]=="moderate":
            fix=a[2] if len(a)>2 else ""
            if not R: print(json.dumps({"cleared":True,"verdict":"NO_FINDINGS"})); return 0
            if sev(R)!="MODERATE": print(json.dumps({"cleared":False,"verdict":"HIGH","reasons":["HIGH severity: Joshua only"]})); return 3
            if any(n in OBJECTIVE for n,_,_ in R): print(json.dumps({"cleared":False,"verdict":"NOT_FIXED","reasons":["licence/source detector still fires: fix it"]})); return 3
            ctx="; ".join(f"rule {n} flag {f!r}" for n,f,_ in R)+" | fix made: "+fix
            r=subprocess.run([sys.executable,REVIEW,a[1],ctx],capture_output=True,text=True,timeout=300)
            try: v=json.loads(r.stdout.strip().splitlines()[-1])
            except Exception: v={"verdict":"UNSURE","reasons":["unparseable reviewer output"]}
            ok=r.returncode==0 and v.get("verdict")=="SAFE"
            if ok: open(MC,"a").write(json.dumps({"ts":datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),"site":SITE,"bot":BOT,"title":a[3] if len(a)>3 else title,
                "rule":sorted(set(n for n,_,_ in R)),"fix":fix,"chatgpt_verdict":"SAFE: "+"; ".join(map(str,v.get("reasons",[])))[:500],"sha256":h},ensure_ascii=False)+"\n")
            print(json.dumps({"cleared":ok,**v})); return 0 if ok else 3
    print(__doc__); return 2
if __name__=="__main__": sys.exit(main(sys.argv[1:]))
