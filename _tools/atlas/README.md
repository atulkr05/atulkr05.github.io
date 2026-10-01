# Faceprint Atlas: maintenance notes

The atlas lives at `atlas.html` and is published at https://atulkr05.github.io/atlas.html.
This folder starts with an underscore, so GitHub Pages' default Jekyll build does not publish it.

## Files

| File | What it holds |
|---|---|
| `atlas.html` | Page shell: site navbar, section headings, footer |
| `assets/css/atlas.css` | Atlas styles, built on the tokens in `assets/css/styles.css` |
| `assets/js/atlas.js` | Draws every section and runs the library filters |
| `assets/data/atlas-data.js` | All content: families, papers, attack-defense pairs, reading paths, open problems |
| `assets/data/faceprint-atlas.xlsx` | Excel download, generated from `atlas-data.js` |
| `_tools/atlas/build_xlsx.py` | Validates `atlas-data.js` and rebuilds the Excel file |

## Add or edit a paper

1. Open `assets/data/atlas-data.js`. Everything after `window.ATLAS =` is strict JSON: double quotes, no trailing commas, no comments.
2. Copy an existing object in the `papers` list, paste it next to papers of the same family, and edit every field.
3. Rebuild and validate:

   ```bash
   pip install openpyxl
   python3 _tools/atlas/build_xlsx.py
   ```

   The script stops with a list of problems if an id is duplicated, a family key is unknown, a field is missing, or a reading path or attack-defense pair points at an id that does not exist.
4. Preview locally. The data loads as a script, so opening `atlas.html` straight from disk works. A local server also works:

   ```bash
   python3 -m http.server 8000
   # then open http://localhost:8000/atlas.html
   ```

## Paper fields

| Field | Type | Notes |
|---|---|---|
| `id` | text | Unique, lowercase, usually first author surname plus year, for example `shan2020`. Used in permalinks: `atlas.html#p-shan2020` |
| `title`, `authors` | text | Authors comma-separated, as published |
| `year` | number | Year of publication or first public release |
| `venue` | text | As published, for example `CVPR` or `IEEE TIFS`. Say `arXiv preprint` or `Under review (...)` when not yet published |
| `venueType` | text | One of `Vision`, `Security`, `ML`, `Biometrics`, `Journal`, `Preprint`, `Other` |
| `family` | text | A key from `families`: `obf`, `dp`, `gen`, `adv`, `unl`, `tpl`, `soft`, `data`, `mul`, `atk`, `surv` |
| `tags` | list of text | Short keywords shown on the card |
| `approach`, `findings` | text | One paragraph each. Quote numbers only when the paper states them |
| `datasets`, `models` | text | As reported in the paper; use `See paper` when unsure |
| `threatModel`, `utility`, `limitations` | text | What it protects against, what stays usable, and known weaknesses or later attacks |
| `code` | true or false | `true` only when `github` holds a confirmed repository or official code page |
| `github` | text | Repository URL, or empty |
| `arxiv` | text | arXiv id such as `2002.08327`, or empty |
| `doi` | text | DOI without the resolver, such as `10.1145/2976749.2978392`, or empty |
| `url` | text | Publisher or project page, used when there is no arXiv id or DOI, or empty |

The page links to arXiv first, then the DOI, then `url`, and always adds a Google Scholar search for the exact title.

## Other lists in the data file

- `families`: name, short label, layer (`picture`, `numbers`, `system` or `cross`), colour group, description, examples.
- `groups`: the eight colour groups used by the charts. The colours come from a palette checked for colour-blind separation, so change them with care.
- `duels`: `defense` is a paper id or free text, `attack` must be a paper id, `verdict` is one or two sentences.
- `paths`: reading lists of paper ids, shown in order.
- `openProblems`: title and text.
- `updated`: shown in the page footer and the workbook; change it when you edit the data.
