import { pt } from './pt';
import { en } from './en';
import { modulesPt, modulesEn, mergeDictionaries } from './modules';
export const fullDictionaries = { pt: mergeDictionaries(pt, modulesPt), en: mergeDictionaries(en, modulesEn) };
