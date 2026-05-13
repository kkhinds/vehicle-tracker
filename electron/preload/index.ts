import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  fuel: {
    getAll: () => ipcRenderer.invoke('fuel:getAll'),
    add: (entry: unknown) => ipcRenderer.invoke('fuel:add', entry),
    update: (id: number, entry: unknown) => ipcRenderer.invoke('fuel:update', id, entry),
    delete: (id: number) => ipcRenderer.invoke('fuel:delete', id),
  },
  maintenance: {
    getAll: () => ipcRenderer.invoke('maintenance:getAll'),
    add: (entry: unknown) => ipcRenderer.invoke('maintenance:add', entry),
    update: (id: number, entry: unknown) => ipcRenderer.invoke('maintenance:update', id, entry),
    delete: (id: number) => ipcRenderer.invoke('maintenance:delete', id),
  },
  schedule: {
    getAll: () => ipcRenderer.invoke('schedule:getAll'),
    add: (interval: unknown) => ipcRenderer.invoke('schedule:add', interval),
    update: (id: number, data: unknown) => ipcRenderer.invoke('schedule:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('schedule:delete', id),
    complete: (id: number, odometer: number, date: string) =>
      ipcRenderer.invoke('schedule:complete', id, odometer, date),
  },
  insurance: {
    getAll: () => ipcRenderer.invoke('insurance:getAll'),
    add: (policy: unknown) => ipcRenderer.invoke('insurance:add', policy),
    update: (id: number, policy: unknown) => ipcRenderer.invoke('insurance:update', id, policy),
    delete: (id: number) => ipcRenderer.invoke('insurance:delete', id),
    deactivate: (id: number) => ipcRenderer.invoke('insurance:deactivate', id),
  },
  notes: {
    getAll: () => ipcRenderer.invoke('notes:getAll'),
    search: (query: string) => ipcRenderer.invoke('notes:search', query),
    add: (note: unknown) => ipcRenderer.invoke('notes:add', note),
    update: (id: number, note: unknown) => ipcRenderer.invoke('notes:update', id, note),
    delete: (id: number) => ipcRenderer.invoke('notes:delete', id),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings: unknown) => ipcRenderer.invoke('settings:update', settings),
  },
  files: {
    openDialog: (options: unknown) => ipcRenderer.invoke('files:openDialog', options),
    savePhoto: (sourcePath: string, category: string) =>
      ipcRenderer.invoke('files:savePhoto', sourcePath, category),
    deleteFile: (filePath: string) => ipcRenderer.invoke('files:deleteFile', filePath),
    getImageData: (filePath: string) => ipcRenderer.invoke('files:getImageData', filePath),
    openFile: (filePath: string) => ipcRenderer.invoke('files:openFile', filePath),
    getLocalFileUrl: (filePath: string) => `localfile://${encodeURIComponent(filePath)}`,
  },
  dashboard: {
    getSummary: () => ipcRenderer.invoke('dashboard:getSummary'),
  },
  expenses: {
    getSummary: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke('expenses:getSummary', startDate, endDate),
    exportCsv: (startDate?: string, endDate?: string, category?: string) =>
      ipcRenderer.invoke('expenses:exportCsv', startDate, endDate, category),
  },
})
