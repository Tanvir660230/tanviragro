"use client";

import React, { createContext, useContext } from "react";
import type { Dictionary, Locale } from "./types";
import enDictionary from "./dictionaries/en.json";

interface I18nContextType {
  t: Dictionary;
  locale: Locale;
}

const defaultContextValue: I18nContextType = {
  t: enDictionary as unknown as Dictionary,
  locale: "en",
};

const I18nContext = createContext<I18nContextType>(defaultContextValue);

export function I18nProvider({
  dictionary,
  locale,
  children,
}: {
  dictionary?: Dictionary;
  locale?: Locale;
  children: React.ReactNode;
}) {
  return (
    <I18nContext.Provider
      value={{
        t: dictionary ?? defaultContextValue.t,
        locale: locale ?? defaultContextValue.locale,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation(): I18nContextType {
  const context = useContext(I18nContext);
  return context ?? defaultContextValue;
}
