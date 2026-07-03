import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
  },
  vehicles: {
    getAll: () => ipcRenderer.invoke('vehicles:getAll'),
    get: (id: number) => ipcRenderer.invoke('vehicles:get', id),
    add: (vehicle: unknown) => ipcRenderer.invoke('vehicles:add', vehicle),
    update: (id: number, data: unknown) => ipcRenderer.invoke('vehicles:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('vehicles:delete', id),
    setCurrent: (id: number) => ipcRenderer.invoke('vehicles:setCurrent', id),
  },
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
    findMatchingInterval: (category: string, description: string) =>
      ipcRenderer.invoke('maintenance:findMatchingInterval', category, description),
  },
  schedule: {
    getAll: () => ipcRenderer.invoke('schedule:getAll'),
    add: (interval: unknown) => ipcRenderer.invoke('schedule:add', interval),
    update: (id: number, data: unknown) => ipcRenderer.invoke('schedule:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('schedule:delete', id),
    complete: (id: number, odometer: number, date: string) =>
      ipcRenderer.invoke('schedule:complete', id, odometer, date),
    markDone: (id: number, odometer: number, date: string) =>
      ipcRenderer.invoke('schedule:markDone', id, odometer, date),
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
  tires: {
    getSets: () => ipcRenderer.invoke('tires:getSets'),
    addSet: (set: unknown) => ipcRenderer.invoke('tires:addSet', set),
    updateSet: (id: number, data: unknown) => ipcRenderer.invoke('tires:updateSet', id, data),
    deleteSet: (id: number) => ipcRenderer.invoke('tires:deleteSet', id),
    retireSet: (id: number, date: string, odometer: number) =>
      ipcRenderer.invoke('tires:retireSet', id, date, odometer),
    getInspections: (tireSetId: number) => ipcRenderer.invoke('tires:getInspections', tireSetId),
    addInspection: (inspection: unknown) => ipcRenderer.invoke('tires:addInspection', inspection),
    deleteInspection: (id: number) => ipcRenderer.invoke('tires:deleteInspection', id),
    getRotations: (tireSetId: number) => ipcRenderer.invoke('tires:getRotations', tireSetId),
    addRotation: (rotation: unknown) => ipcRenderer.invoke('tires:addRotation', rotation),
    deleteRotation: (id: number) => ipcRenderer.invoke('tires:deleteRotation', id),
  },
  documents: {
    getAll: () => ipcRenderer.invoke('documents:getAll'),
    add: (doc: unknown) => ipcRenderer.invoke('documents:add', doc),
    update: (id: number, data: unknown) => ipcRenderer.invoke('documents:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('documents:delete', id),
  },
  notifications: {
    check: () => ipcRenderer.invoke('notifications:check'),
    test: () => ipcRenderer.invoke('notifications:test'),
  },
  fluids: {
    getPresets: () => ipcRenderer.invoke('fluids:getPresets'),
    getAll: () => ipcRenderer.invoke('fluids:getAll'),
    add: (entry: unknown) => ipcRenderer.invoke('fluids:add', entry),
    update: (id: number, data: unknown) => ipcRenderer.invoke('fluids:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('fluids:delete', id),
    getStats: () => ipcRenderer.invoke('fluids:getStats'),
    getDashboardWarning: () => ipcRenderer.invoke('fluids:getDashboardWarning'),
  },
  backup: {
    getStatus: () => ipcRenderer.invoke('backup:getStatus'),
    updateSettings: (partial: unknown) => ipcRenderer.invoke('backup:updateSettings', partial),
    createNow: () => ipcRenderer.invoke('backup:createNow'),
    export: () => ipcRenderer.invoke('backup:export'),
    pickRestoreFile: () => ipcRenderer.invoke('backup:pickRestoreFile'),
    restore: (filePath: string) => ipcRenderer.invoke('backup:restore', filePath),
    delete: (filePath: string) => ipcRenderer.invoke('backup:delete', filePath),
    openFolder: () => ipcRenderer.invoke('backup:openFolder'),
    chooseDir: () => ipcRenderer.invoke('backup:chooseDir'),
    resetDir: () => ipcRenderer.invoke('backup:resetDir'),
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    getStatus: () => ipcRenderer.invoke('updater:getStatus'),
    onStatus: (callback: (status: unknown) => void) => {
      const listener = (_: unknown, status: unknown) => callback(status)
      ipcRenderer.on('updater:status', listener)
      return () => ipcRenderer.removeListener('updater:status', listener)
    },
  },
})
