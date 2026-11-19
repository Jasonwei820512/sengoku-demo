export const languages = Object.freeze({
  ja: '日本語',
  'zh-Hant': '繁體中文',
  'zh-Hans': '简体中文',
  en: 'English'
});

export function preferredLanguage(preferences) {
  const [first] = preferences;
  const tag = first?.toLowerCase() ?? '';
  if (/^ja(?:-|$)/.test(tag)) return 'ja';
  if (/^zh(?:-|$)/.test(tag)) {
    return /(?:^|-)(?:hant|tw|hk|mo)(?:-|$)/.test(tag) && !tag.includes('-hans')
      ? 'zh-Hant' : 'zh-Hans';
  }
  return 'en';
}

export function initialLanguage(saved, query, preferences) {
  const forced = new URLSearchParams(query).get('lang');
  if (Object.hasOwn(languages, forced)) return forced;
  if (Object.hasOwn(languages, saved)) return saved;
  return preferredLanguage(preferences);
}

export async function loadMessages(language, fetchFile = fetch) {
  const response = await fetchFile(`lang/${language}.json`);
  if (!response.ok) throw new Error(`Could not load locale ${language}`);
  return response.json();
}

export function createI18n() {
  let messages = Object.create(null);
  return {
    use(next) {
      messages = next;
    },
    t(key, fields = []) {
      const message = messages[key];
      if (typeof message !== 'string') {
        console.error('Missing translation:', key);
        return '';
      }
      return message.replace(/\{(\d+)\}/g, (_, index) => String(fields[index] ?? ''));
    }
  };
}
