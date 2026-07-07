import re, glob

# Build date -> slug mapping
slug_map = {}
for f in glob.glob('src/content/news/*.md'):
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    date_match = re.search(r'date:\s*(\S+)', content)
    if date_match:
        date = date_match.group(1)
        slug = f.rsplit('/', 1)[-1].replace('.md', '')
        slug_map[date] = slug
        print(f'{date} -> {slug}')

# Fix schedule.astro
with open('src/pages/schedule.astro', 'r', encoding='utf-8') as f:
    c = f.read()

slug_map_js = 'const newsSlugs = ' + str(slug_map) + ';'
c = c.replace('const allEvents', slug_map_js + '\nconst allEvents')
old = '/news/${evt.date}'
new = '/news/${newsSlugs[evt.date] || evt.date}'
c = c.replace(old, new)

with open('src/pages/schedule.astro', 'w', encoding='utf-8') as f:
    f.write(c)
print('Schedule fixed')

# Fix index.astro
with open('src/pages/index.astro', 'r', encoding='utf-8') as f:
    c = f.read()

old2 = "/news/${newsSlugMap.get(evt.date) || '#'}"
new2 = "/news/${newsSlugMap.get(evt.date) || evt.date}"
c = c.replace(old2, new2)

with open('src/pages/index.astro', 'w', encoding='utf-8') as f:
    f.write(c)
print('Index fixed')
