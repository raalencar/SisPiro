#!/usr/bin/env python3
"""Normaliza o dump da WooCommerce Store API da Amazon Fireworks em catalogo.json/.csv.

Descrições do site de origem contêm JS malicioso injetado (WordPress comprometido);
todo parágrafo com código é descartado — nunca reaproveitar o HTML cru.
"""
import csv, glob, html, json, os, re

FIELDS = {
    "codigo": r"C[óo]digo", "efeito": r"Efeito", "embalagem_unitaria": r"Embalagem Unit[áa]ria",
    "embalagem_master": r"(?:Embalagem|Caixa) Master", "tempo_aproximado": r"Tempo Aprox(?:imado)?",
    "maquina": r"M[áa]quina", "quantidade_por_rolo": r"Quantidade por rolo", "obs": r"Obs",
}
MALICIOUS = re.compile(r"_0x[0-9a-f]{3,}|function\s*\(|\bwindow\.|localStorage|x68x74x74x70")

def clean_lines(raw):
    text = re.sub(r"<br\s*/?>", "\n", raw or "")
    text = re.sub(r"</p>", "\n\n", text)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    paras = [p for p in re.split(r"\n\s*\n", text) if p.strip() and not MALICIOUS.search(p)]
    return [l.strip() for p in paras for l in p.splitlines() if l.strip()]

def parse(p):
    lines = clean_lines(p["description"])
    out, free = {k: None for k in FIELDS}, []
    for l in lines:
        for key, pat in FIELDS.items():
            m = re.match(rf"{pat}\s*:\s*(.*)", l, re.I)
            if m:
                out[key] = m.group(1).strip().rstrip(".") or None
                break
        else:
            free.append(re.sub(r"^Descri[çc][ãa]o\s*:\s*", "", l))
    if out["codigo"]:
        out["codigo"] = re.sub(r"\s+", " ", out["codigo"]).upper()
    cats = [c["name"] for c in p["categories"]]
    imgs = []
    for i, im in enumerate(p["images"]):
        ext = os.path.splitext(im["src"].split("?")[0])[1].lower() or ".jpg"
        base = f"{(out['codigo'] or 'SEMCOD').replace(' ', '')}_wc{p['id']}"
        imgs.append({"url": im["src"], "arquivo": f"imagens/{base}{'' if i == 0 else f'_{i}'}{ext}"})
    return {
        "fornecedor": "Amazon Fireworks", "wc_id": p["id"], "nome": html.unescape(p["name"]).strip(),
        "slug": p["slug"], "url": p["permalink"], **out, "descricao": " ".join(free) or None,
        "categorias": cats, "tags": [html.unescape(t["name"]) for t in p.get("tags", [])],
        "imagens": imgs,
    }

products = [x for f in sorted(glob.glob("raw/products-p*.json")) for x in json.load(open(f))]
items = [parse(p) for p in products]
json.dump(items, open("catalogo.json", "w"), ensure_ascii=False, indent=2)
cols = ["wc_id", "codigo", "nome", "efeito", "embalagem_unitaria", "embalagem_master", "tempo_aproximado",
        "maquina", "quantidade_por_rolo", "obs", "descricao", "categorias", "imagem_principal", "url"]
with open("catalogo.csv", "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    for it in items:
        w.writerow({**it, "categorias": "|".join(it["categorias"]),
                    "imagem_principal": it["imagens"][0]["arquivo"] if it["imagens"] else ""})
with open("imagens.tsv", "w") as fh:
    for it in items:
        for im in it["imagens"]:
            fh.write(f"{im['url']}\t{im['arquivo']}\n")
print(len(items), "produtos")
