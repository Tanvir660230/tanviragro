"use client";

import React, { createContext, useContext } from "react";
import type { Dictionary, Locale } from "./getDictionary";

interface I18nContextType {
  t: Dictionary;
  locale: Locale;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({
  dictionary,
  locale,
  children,
}: {
  dictionary: Dictionary;
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ t: dictionary, locale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
