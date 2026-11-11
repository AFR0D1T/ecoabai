/** Глобальная конфигурация приложения. */

// Село Абай, Карасайский район, Алматинская область (по OpenStreetMap)
export const DEFAULT_MAP_CENTER: { lat: number; lng: number } = { lat: 43.2105, lng: 76.7606 };
export const DEFAULT_MAP_ZOOM = 15;

/**
 * Подложки карты (без API-ключей): схема — OpenStreetMap, спутник — Esri. Подписи источников обязательны.
 * Для коммерческого использования спутника проверьте условия ArcGIS (бесплатный аккаунт разработчика + ключ).
 */
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

export interface TileSource {
  url: string;
  attribution: string;
  maxNativeZoom: number;
  /** CSS-класс слоя (например, фильтр для тёмной темы) */
  className?: string;
}

export const MAP_TILES = {
  /** Схема (стандартная OpenStreetMap) */
  scheme: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19,
  },
  /** Спутник (Esri World Imagery) */
  satellite: {
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    attribution: '&copy; <a href="https://www.esri.com">Esri</a>, Maxar',
    maxNativeZoom: 19,
  },
  /** Дороги и названия улиц поверх спутника */
  satelliteRoads: {
    url: `${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`,
    attribution: '',
    maxNativeZoom: 19,
  },
  /** Названия населённых пунктов поверх спутника */
  satellitePlaces: {
    url: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
    attribution: '',
    maxNativeZoom: 19,
  },
} satisfies Record<string, TileSource>;

export const MAP_MAX_ZOOM = 19;

/** Базовый адрес API. По умолчанию — тот же домен (/api), чтобы httpOnly-cookie работали без CORS. */
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

/** Максимальный размер фото по длинной стороне перед загрузкой. */
export const PHOTO_MAX_SIDE = 1600;
export const MAX_REPORT_PHOTOS = 3;
export const REPORT_DESCRIPTION_MAX = 500;

export const DEFAULT_EVENT_POINTS = 20;
export const REPORT_CONFIRMED_POINTS = 10;

/** Демо-аккаунты из сида бэкенда — кнопки быстрого входа видны только в dev-режиме. */
export const DEV_TEST_ACCOUNTS = {
  resident: { email: 'resident@test.kz', password: '123456' },
  admin: { email: 'admin@test.kz', password: '123456' },
} as const;


export const STORAGE_KEYS = {
  lang: 'ecoabai.lang',
  theme: 'ecoabai.theme',
  mapStyle: 'ecoabai.mapStyle',
  seenBadgeNotifications: 'ecoabai.seenBadgeNotifs',
} as const;
