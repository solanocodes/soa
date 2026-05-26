'use client';

let socket: any = null;

export function getSocket(): any {
  return null;
}

export function connectSocket(): any {
  return { on: () => {}, off: () => {}, emit: () => {}, connected: false };
}

export function disconnectSocket() {}
