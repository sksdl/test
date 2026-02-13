const grid = document.getElementById('gallery-grid');
const toolbar = document.querySelector('.toolbar');
const searchInput = document.getElementById('search-input');
const template = document.getElementById('card-template');

let items = [];
let activeCategory = 'All';
let keyword = '';

function renderCards() {
  const filtered = items.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesKeyword = `${item.title} ${item.description}`.toLowerCase().includes(keyword);
    return matchesCategory && matchesKeyword;
  });

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty">조건에 맞는 작품이 없습니다. 검색어 또는 카테고리를 바꿔보세요.</div>';
    return;
  }

  filtered.forEach((item) => {
    const node = template.content.cloneNode(true);
    const img = node.querySelector('img');
    img.src = item.image;
    img.alt = `${item.title} 이미지`;

    node.querySelector('.badge').textContent = item.category;
    node.querySelector('h2').textContent = item.title;
    node.querySelector('p').textContent = item.description;
    grid.appendChild(node);
  });
}

function renderCategories(data) {
  const categories = ['All', ...new Set(data.map((item) => item.category))];
  toolbar.innerHTML = '';

  categories.forEach((category) => {
    const button = document.createElement('button');
    button.className = `chip${category === activeCategory ? ' active' : ''}`;
    button.dataset.category = category;
    button.textContent = category;
    button.addEventListener('click', () => {
      activeCategory = category;
      renderCategories(items);
      renderCards();
    });
    toolbar.appendChild(button);
  });
}

async function init() {
  try {
    const response = await fetch('/api/gallery');
    const data = await response.json();

    document.getElementById('gallery-title').textContent = data.title;
    document.getElementById('gallery-subtitle').textContent = data.subtitle;

    items = data.items;
    renderCategories(items);
    renderCards();

    searchInput.addEventListener('input', (event) => {
      keyword = event.target.value.trim().toLowerCase();
      renderCards();
    });
  } catch (error) {
    grid.innerHTML = '<div class="empty">데이터를 불러오지 못했습니다. 서버 상태를 확인해주세요.</div>';
    console.error(error);
  }
}

init();
