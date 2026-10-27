(() => {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button || button.disabled) return;
    event.preventDefault();
    const label = button.textContent;
    const status = document.getElementById('copy-status');
    button.disabled = true;
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = 'Copied';
      status.textContent = 'Copied to clipboard.';
    } catch {
      button.textContent = 'Copy failed';
      status.textContent = 'Could not copy. Select and copy the command manually.';
    }
    setTimeout(() => { button.textContent = label; button.disabled = false; }, 1500);
  });

  const q = document.getElementById('q');
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || !q || event.target.closest('input, textarea, select')) return;
    event.preventDefault();
    q.focus();
  });

  const sections = document.getElementById('sections');
  const results = document.getElementById('results');
  if (!q || !sections || !results) return;
  const grid = document.getElementById('results-grid');
  const title = document.getElementById('results-title');
  const noMatch = document.getElementById('no-match');
  const category = document.getElementById('category');
  const sortButtons = [...document.querySelectorAll('[data-sort]')];
  const cards = [...grid.children];
  const sorters = {
    featured: (a, b) => b.dataset.featured.localeCompare(a.dataset.featured) || a.dataset.name.localeCompare(b.dataset.name),
    new: (a, b) => b.dataset.added.localeCompare(a.dataset.added) || a.dataset.name.localeCompare(b.dataset.name),
    name: (a, b) => a.dataset.name.localeCompare(b.dataset.name)
  };
  const params = new URLSearchParams(location.search);
  let sort = sorters[params.get('sort')] ? params.get('sort') : 'featured';
  q.value = params.get('q') ?? '';
  category.value = [...category.options].some((o) => o.value === params.get('category')) ? params.get('category') : '';

  function apply() {
    const text = q.value.trim().toLowerCase();
    const filtering = Boolean(text || category.value || sort !== 'featured');
    sections.hidden = filtering;
    results.hidden = !filtering;
    for (const button of sortButtons) button.setAttribute('aria-pressed', String(button.dataset.sort === sort));
    let shown = 0;
    for (const card of [...cards].sort(sorters[sort])) {
      const hit = (!text || card.dataset.search.includes(text)) && (!category.value || card.dataset.category === category.value);
      card.hidden = !hit;
      if (hit) shown += 1;
      grid.append(card);
    }
    const label = category.value ? category.selectedOptions[0].textContent.replace(/ \(\d+\)$/, '') : 'All plugins';
    title.textContent = label + ' (' + shown + ')';
    noMatch.hidden = shown > 0;
    const next = new URLSearchParams();
    if (text) next.set('q', q.value.trim());
    if (category.value) next.set('category', category.value);
    if (sort !== 'featured') next.set('sort', sort);
    history.replaceState(null, '', next.size ? '?' + next : location.pathname);
  }

  q.addEventListener('input', apply);
  category.addEventListener('change', apply);
  for (const button of sortButtons) button.addEventListener('click', () => { sort = button.dataset.sort; apply(); });
  apply();
})();
