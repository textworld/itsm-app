export function richTextHasContent(html) {
  if (typeof document === 'undefined') {
    return Boolean(String(html || '').trim());
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html || '';
  return Boolean(wrapper.textContent.trim() || wrapper.querySelector('img'));
}

export function richTextToPlainText(html) {
  if (typeof document === 'undefined') {
    return String(html || '').trim();
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html || '';
  return wrapper.textContent.trim();
}
