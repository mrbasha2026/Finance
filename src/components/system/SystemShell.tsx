'use client';

// Legacy component — not used in the current app routing.
export type SystemModule = string;

export function SystemShell({ children }: { children: React.ReactNode; [key: string]: unknown }) {
  return <>{children}</>;
}

import React from 'react';
