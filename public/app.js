const grid = document.getElementById('gallery-grid');
const toolbar = document.querySelector('.toolbar');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const template = document.getElementById('card-template');
const totalCount = document.getElementById('total-count');
const resultCount = document.getElementById('result-count');
const loadMoreBtn = document.getElementById('load-more');
const sortSelect = document.getElementById('sort-select');
const categoryList = document.getElementById('category-list');

const adminTokenInput = document.getElementById('admin-token');
const adminLoginBtn = document.getElementById('admin-login-btn');
const deleteAllBtn = document.getElementById('delete-all-btn');

const imageModal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-description');
const modalCategory = document.getElementById('modal-category');
const modalPrev = document.getElementById('modal-prev');
const modalNext = document.getElementById('modal-next');

const uploadModal = document.getElementById('upload-modal');
const uploadOpen = document.getElementById('upload-open');
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const dropzone = document.getElementById('dropzone');
const previewImage = document.getElementById('preview-image');
const uploadStatus = document.getElementById('upload-status');
const progressBar = document.getElementById('progress-bar');
const themeToggle = document.getElementById('theme-toggle');

let items = [];
let activeCategory = 'All';
let keyword = '';
let visibleCount = 20;
let sortBy = 'latest';
let modalIndex = -1;
let latestFiltered = [];
let isAdminLoggedIn = false;

function debounce(fn, delay = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function showSkeleton() {
  grid.innerHTML = '';
  for (let i = 0; i < 8; i += 1) {
    const sk = document.createElement('div');
    sk.className = 'skeleton';
    grid.appendChild(sk);
  }
}

function isNewItem(item) {
  const days = (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return days <= 7;
}

function getFiltered() {
  const list = items.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesKeyword = `${item.title} ${item.description}`.toLowerCase().includes(keyword);
    return matchesCategory && matchesKeyword;
  });

  list.sort((a, b) => {
    if (sortBy === 'name') return a.title.localeCompare(b.title, 'ko');
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return list;
}

function highlight(text) {
  if (!keyword) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'ig'), '<mark>$1</mark>');
}

async function deleteItem(item) {
  const headers = { 'Content-Type': 'application/json' };
  let body;

  if (isAdminLoggedIn) {
    headers['x-admin-token'] = adminTokenInput.value.trim();
    body = {};
  } else {
    const nickname = window.prompt('삭제하려면 업로드 시 입력한 익명 닉네임을 입력하세요.');
    if (!nickname) return;
    const pin = window.prompt('삭제하려면 4자리 비밀번호를 입력하세요.');
    if (!pin) return;
    body = { nickname: nickname.trim(), pin: pin.trim() };
  }

  const response = await fetch(`/api/gallery/${item.id}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify(body)
  });

  const payload = await response.json();
  if (!response.ok) {
    alert(payload.message || '삭제 실패');
    return;
  }
  await fetchData();
}

function renderCards() {
  const filtered = getFiltered();
  latestFiltered = filtered;
  resultCount.textContent = `검색 결과 ${filtered.length}개`;
  totalCount.textContent = `총 ${items.length}개 작품`;

  const paged = filtered.slice(0, visibleCount);
  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty">조건에 맞는 작품이 없습니다.</div>';
    loadMoreBtn.hidden = true;
    return;
  }

  paged.forEach((item, index) => {
    const node = template.content.cloneNode(true);
    const img = node.querySelector('img');
    img.src = item.image;
    img.alt = `${item.title} 이미지`;

    node.querySelector('.badge').textContent = item.category;
    node.querySelector('h2').innerHTML = highlight(item.title);
    node.querySelector('p').innerHTML = highlight(item.description);
    node.querySelector('.author').textContent = `by 익명 ${item.authorNickname || 'unknown'}`;

    const newBadge = node.querySelector('.new-badge');
    newBadge.hidden = !isNewItem(item);

    const viewBtn = node.querySelector('.overlay-view');
    viewBtn.addEventListener('click', () => openModal(index));
    img.addEventListener('click', () => openModal(index));

    const delBtn = node.querySelector('.overlay-delete');
    delBtn.style.display = 'inline-block';
    delBtn.addEventListener('click', async () => {
      const ok = window.confirm(`'${item.title}' 작품을 삭제할까요?`);
      if (!ok) return;
      await deleteItem(item);
    });

    grid.appendChild(node);
  });

  loadMoreBtn.hidden = visibleCount >= filtered.length;
}

function renderCategories() {
  const categories = ['All', ...new Set(items.map((item) => item.category))];
  toolbar.innerHTML = '';
  categoryList.innerHTML = '';

  categories.filter((x) => x !== 'All').forEach((category) => {
    const op = document.createElement('option');
    op.value = category;
    categoryList.appendChild(op);
  });

  categories.forEach((category) => {
    const button = document.createElement('button');
    button.className = `chip${category === activeCategory ? ' active' : ''}`;
    button.textContent = category;
    button.addEventListener('click', () => {
      activeCategory = category;
      visibleCount = 20;
      renderCategories();
      renderCards();
    });
    toolbar.appendChild(button);
  });
}

function openModal(index) {
  modalIndex = index;
  const item = latestFiltered[index];
  if (!item) return;
  modalImage.src = item.image;
  modalTitle.textContent = item.title;
  modalDesc.textContent = item.description;
  modalCategory.textContent = item.category;
  imageModal.hidden = false;
}

function stepModal(direction) {
  const next = modalIndex + direction;
  if (next < 0 || next >= latestFiltered.length) return;
  openModal(next);
}

function closeModal() { imageModal.hidden = true; }
function closeUploadModal() { uploadModal.hidden = true; }
function openUploadModal() { uploadModal.hidden = false; }

function previewFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    previewImage.src = reader.result;
    previewImage.hidden = false;
    if (!document.getElementById('upload-title').value.trim()) {
      document.getElementById('upload-title').value = file.name.replace(/\.[^.]+$/, '');
    }
  };
  reader.readAsDataURL(file);
}

async function fetchData() {
  showSkeleton();
  const response = await fetch('/api/gallery');
  const data = await response.json();
  document.getElementById('gallery-title').textContent = data.title;
  document.getElementById('gallery-subtitle').textContent = data.subtitle;
  items = data.items || [];
  renderCategories();
  renderCards();
}

uploadForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const pinValue = document.getElementById('upload-pin').value.trim();
  if (!/^\d{4}$/.test(pinValue)) {
    uploadStatus.textContent = '삭제용 비밀번호는 4자리 숫자여야 합니다.';
    return;
  }

  const file = fileInput.files[0];
  if (!file) {
    uploadStatus.textContent = '이미지를 먼저 선택하세요.';
    return;
  }

  const fd = new FormData(uploadForm);
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/gallery/upload');
  uploadStatus.textContent = '업로드 중...';
  progressBar.style.width = '0%';

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) progressBar.style.width = `${Math.round((e.loaded / e.total) * 100)}%`;
  };

  xhr.onload = async () => {
    const payload = JSON.parse(xhr.responseText || '{}');
    if (xhr.status >= 200 && xhr.status < 300) {
      uploadStatus.textContent = '업로드 완료!';
      uploadForm.reset();
      previewImage.hidden = true;
      progressBar.style.width = '100%';
      await fetchData();
      setTimeout(closeUploadModal, 500);
      return;
    }
    uploadStatus.textContent = payload.message || '업로드 실패';
  };

  xhr.onerror = () => { uploadStatus.textContent = '네트워크 오류'; };
  xhr.send(fd);
});

const debouncedSearch = debounce((value) => {
  keyword = value.trim().toLowerCase();
  visibleCount = 20;
  renderCards();
}, 400);

searchInput.addEventListener('input', (event) => debouncedSearch(event.target.value));
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  keyword = '';
  renderCards();
});
loadMoreBtn.addEventListener('click', () => {
  visibleCount += 20;
  renderCards();
});
sortSelect.addEventListener('change', (event) => {
  sortBy = event.target.value;
  renderCards();
});

adminLoginBtn.addEventListener('click', async () => {
  const token = adminTokenInput.value.trim();
  if (!token) {
    alert('관리자 토큰을 입력하세요.');
    return;
  }
  const response = await fetch('/api/admin/verify', { headers: { 'x-admin-token': token } });
  if (!response.ok) {
    alert('관리자 로그인 실패');
    return;
  }
  isAdminLoggedIn = true;
  adminLoginBtn.textContent = '관리자 로그인됨';
  deleteAllBtn.hidden = false;
  renderCards();
});

deleteAllBtn.addEventListener('click', async () => {
  if (!isAdminLoggedIn) return;
  const ok = window.confirm('정말 전체 작품을 삭제할까요? 이 작업은 되돌릴 수 없습니다.');
  if (!ok) return;

  const response = await fetch('/api/gallery', {
    method: 'DELETE',
    headers: { 'x-admin-token': adminTokenInput.value.trim() }
  });
  const payload = await response.json();
  if (!response.ok) {
    alert(payload.message || '전체 삭제 실패');
    return;
  }
  await fetchData();
});

modalPrev.addEventListener('click', () => stepModal(-1));
modalNext.addEventListener('click', () => stepModal(1));
imageModal.addEventListener('click', (event) => {
  if (event.target.dataset.close === 'true') closeModal();
});
uploadModal.addEventListener('click', (event) => {
  if (event.target.dataset.closeUpload === 'true') closeUploadModal();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal();
    closeUploadModal();
  }
  if (!imageModal.hidden && event.key === 'ArrowRight') stepModal(1);
  if (!imageModal.hidden && event.key === 'ArrowLeft') stepModal(-1);
});

uploadOpen.addEventListener('click', openUploadModal);
fileInput.addEventListener('change', () => previewFile(fileInput.files[0]));

['dragenter', 'dragover'].forEach((name) => {
  dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    dropzone.classList.add('drag');
  });
});
['dragleave', 'drop'].forEach((name) => {
  dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
  });
});
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (!file) return;
  fileInput.files = e.dataTransfer.files;
  previewFile(file);
});

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
  themeToggle.textContent = document.body.classList.contains('light') ? '☀️ 라이트' : '🌙 다크';
});

fetchData().catch((error) => {
  grid.innerHTML = '<div class="empty">데이터를 불러오지 못했습니다.</div>';
  console.error(error);
});
