import { useState, useRef } from 'react'
import AppLayout from '../components/AppLayout'

// ── Helpers ────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase()
  if (['pdf'].includes(ext)) return { bg: 'bg-red-50 dark:bg-red-500/15', color: 'text-red-500', label: 'PDF' }
  if (['doc', 'docx'].includes(ext)) return { bg: 'bg-blue-50 dark:bg-blue-500/15', color: 'text-blue-500', label: 'DOC' }
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { bg: 'bg-emerald-50 dark:bg-emerald-500/15', color: 'text-emerald-500', label: 'XLS' }
  if (['txt', 'md'].includes(ext)) return { bg: 'bg-gray-100 dark:bg-white/10', color: 'text-gray-500', label: 'TXT' }
  if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) return { bg: 'bg-violet-50 dark:bg-violet-500/15', color: 'text-violet-500', label: 'IMG' }
  return { bg: 'bg-orange-50 dark:bg-orange-500/15', color: 'text-orange-500', label: ext.toUpperCase().slice(0, 3) }
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, iconBg }) {
  return (
    <div className="bg-white dark:bg-[#13131a] border border-gray-200 dark:border-white/8 rounded-xl p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</p>
      </div>
    </div>
  )
}

// ── Collection Card ────────────────────────────────────────────────────────
function CollectionCard({ ds, onClick, onDelete }) {
  const isSyncing = ds.syncStatus?.startsWith('Syncing')
  const totalDocs = ds.documents.length

  return (
    <div
      onClick={onClick}
      className="relative bg-white dark:bg-[#13131a] border border-gray-200 dark:border-white/8 rounded-xl p-6 flex flex-col gap-3 hover:border-gray-300 dark:hover:border-white/15 transition-colors cursor-pointer group"
    >
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
        title="Delete datasource"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ds.iconBg}`}>
        {ds.icon}
      </div>
      <div className="flex-1">
        <h3 className="text-gray-900 dark:text-white font-semibold text-base mb-1 pr-6">{ds.title}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed line-clamp-2">{ds.description}</p>
      </div>
      <div className="border-t border-gray-100 dark:border-white/5 pt-3 flex items-end justify-between">
        <div>
          <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">{totalDocs} Doc{totalDocs !== 1 ? 's' : ''}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {isSyncing ? (
              <svg className="w-3 h-3 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 11-8 8z" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className={`text-xs ${isSyncing ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`}>
              {ds.syncStatus}
            </span>
          </div>
        </div>
        <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">{ds.size}</span>
      </div>
    </div>
  )
}

// ── Create Card ────────────────────────────────────────────────────────────
function CreateCard({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:border-blue-400 dark:hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-colors cursor-pointer group min-h-[200px] w-full"
    >
      <div className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-white/20 group-hover:border-blue-400 dark:group-hover:border-blue-400 flex items-center justify-center transition-colors">
        <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <p className="text-gray-800 dark:text-gray-200 font-semibold text-sm">Create New Datasource</p>
      <p className="text-gray-400 dark:text-gray-500 text-xs text-center">Import from files, websites, or external apps</p>
    </button>
  )
}

// ── Create Datasource Panel ────────────────────────────────────────────────
function CreateDatasourcePanel({ onClose, onCreate }) {
  const [form, setForm] = useState({ title: '', description: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onCreate(form)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white dark:bg-[#13131a] border-l border-gray-200 dark:border-white/8 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">New Datasource</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Create a collection to store documents</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form id="create-ds-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Preview */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/8">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{form.title || 'Datasource name'}</p>
              <p className="text-xs text-gray-400 mt-0.5">{form.description || 'Description'}</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Product Docs, Support KB..."
              required
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="What kind of documents will be stored here?"
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/8 shrink-0 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
            Cancel
          </button>
          <button form="create-ds-form" type="submit" className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
            Create Datasource
          </button>
        </div>
      </div>
    </>
  )
}

// ── Datasource Detail Panel ────────────────────────────────────────────────
function DatasourceDetailPanel({ ds, onClose, onUpload, onDeleteDoc, onDeleteDatasource }) {
  const fileInputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [deleteDocId, setDeleteDocId] = useState(null)

  const handleFiles = (files) => {
    Array.from(files).forEach(file => {
      onUpload(ds.id, {
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      })
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-[#13131a] border-l border-gray-200 dark:border-white/8 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ds.iconBg}`}>
              {ds.icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">{ds.title}</h2>
              <p className="text-xs text-gray-400 truncate">{ds.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors shrink-0 ml-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sub-stats */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-white/5 shrink-0 flex items-center gap-6">
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{ds.documents.length}</p>
            <p className="text-xs text-gray-400">Documents</p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{ds.size}</p>
            <p className="text-xs text-gray-400">Total size</p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
          <p className="text-xs text-gray-500 dark:text-gray-400">{ds.syncStatus}</p>
        </div>

        {/* Upload zone */}
        <div className="px-6 pt-4 shrink-0">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors ${
              dragging
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10'
                : 'border-gray-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/40 hover:bg-blue-50/40 dark:hover:bg-blue-500/5'
            }`}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${dragging ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-gray-100 dark:bg-white/8'}`}>
              <svg className={`w-5 h-5 ${dragging ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {dragging ? 'Drop files here' : 'Upload documents'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Drag & drop or click — PDF, DOCX, TXT, CSV, MD…</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          />
        </div>

        {/* Documents list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {ds.documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/8 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">No documents yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Upload your first document above</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                {ds.documents.length} Document{ds.documents.length !== 1 ? 's' : ''}
              </p>
              {ds.documents.map(doc => {
                const meta = fileIcon(doc.name)
                const confirmingDelete = deleteDocId === doc.id
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 px-3.5 py-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/8 group hover:border-gray-200 dark:hover:border-white/12 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                      <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatBytes(doc.size)} · {doc.uploadedAt}</p>
                    </div>
                    {confirmingDelete ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Delete?</span>
                        <button
                          onClick={() => { onDeleteDoc(ds.id, doc.id); setDeleteDocId(null) }}
                          className="px-2.5 py-1 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteDocId(null)}
                          className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteDocId(doc.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all shrink-0"
                        title="Delete document"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer – delete datasource */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/8 shrink-0 flex items-center justify-between">
          <button
            onClick={onDeleteDatasource}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete datasource
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────
function DeleteDatasourceModal({ ds, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-[#13131a] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/8 p-6">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/15 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Delete datasource?</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          <span className="font-medium text-gray-700 dark:text-gray-200">{ds.title}</span> and all{' '}
          {ds.documents.length} document{ds.documents.length !== 1 ? 's' : ''} will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Initial seed data ──────────────────────────────────────────────────────
const SEED = [
  {
    id: 1,
    icon: (
      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    iconBg: 'bg-blue-50 dark:bg-blue-500/15',
    title: 'Product Specs',
    description: 'Technical specifications and roadmap documents for Q3 and Q4 products.',
    size: '450 MB',
    syncStatus: 'Last synced: 2 hours ago',
    documents: [
      { id: 101, name: 'Q3-roadmap.pdf', size: 2400000, uploadedAt: 'Jan 10, 2026' },
      { id: 102, name: 'product-spec-v2.docx', size: 870000, uploadedAt: 'Jan 12, 2026' },
    ],
  },
  {
    id: 2,
    icon: (
      <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    iconBg: 'bg-violet-50 dark:bg-violet-500/15',
    title: 'Customer Support',
    description: 'Knowledge base derived from HelpScout articles and resolved tickets.',
    size: '1.2 GB',
    syncStatus: 'Last synced: 1 day ago',
    documents: [
      { id: 201, name: 'faq-2026.md', size: 120000, uploadedAt: 'Feb 1, 2026' },
    ],
  },
  {
    id: 3,
    icon: (
      <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h8M4 18h6" />
      </svg>
    ),
    iconBg: 'bg-emerald-50 dark:bg-emerald-500/15',
    title: 'API Documentation',
    description: 'Public API reference for developers, including endpoint definitions.',
    size: '120 MB',
    syncStatus: 'Last synced: 3 days ago',
    documents: [],
  },
  {
    id: 4,
    icon: (
      <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    iconBg: 'bg-orange-50 dark:bg-orange-500/15',
    title: 'Legal Contracts',
    description: 'Repository of standard service agreements and NDAs.',
    size: '850 MB',
    syncStatus: 'Syncing now...',
    documents: [
      { id: 401, name: 'nda-template.docx', size: 340000, uploadedAt: 'Dec 20, 2025' },
      { id: 402, name: 'service-agreement.pdf', size: 980000, uploadedAt: 'Jan 5, 2026' },
      { id: 403, name: 'terms.pdf', size: 760000, uploadedAt: 'Jan 8, 2026' },
    ],
  },
]

// ── Datasources Page ───────────────────────────────────────────────────────
export default function DatasourcesPage() {
  const [datasources, setDatasources] = useState(SEED)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedDsId, setSelectedDsId] = useState(null)
  const [deleteConfirmDs, setDeleteConfirmDs] = useState(null)
  const [search, setSearch] = useState('')

  const totalDocs = datasources.reduce((sum, ds) => sum + ds.documents.length, 0)

  const filtered = datasources.filter(
    ds =>
      ds.title.toLowerCase().includes(search.toLowerCase()) ||
      ds.description.toLowerCase().includes(search.toLowerCase())
  )

  // Always read the live version from datasources array
  const activePanelDs = selectedDsId ? datasources.find(ds => ds.id === selectedDsId) ?? null : null

  const ICON_SETS = [
    { color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/15' },
    { color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/15' },
    { color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/15' },
    { color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-500/15' },
    { color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/15' },
    { color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-500/15' },
  ]

  const handleCreate = ({ title, description }) => {
    const pick = ICON_SETS[datasources.length % ICON_SETS.length]
    setDatasources(prev => [
      ...prev,
      {
        id: Date.now(),
        icon: (
          <svg className={`w-5 h-5 ${pick.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        ),
        iconBg: pick.bg,
        title,
        description: description || 'No description',
        size: '0 B',
        syncStatus: 'Just created',
        documents: [],
      },
    ])
  }

  const handleUpload = (dsId, doc) => {
    setDatasources(prev =>
      prev.map(ds => ds.id === dsId ? { ...ds, documents: [...ds.documents, doc] } : ds)
    )
  }

  const handleDeleteDoc = (dsId, docId) => {
    setDatasources(prev =>
      prev.map(ds => ds.id === dsId ? { ...ds, documents: ds.documents.filter(d => d.id !== docId) } : ds)
    )
  }

  const handleDeleteDs = (ds) => {
    setDeleteConfirmDs(ds)
  }

  const confirmDeleteDs = () => {
    const id = deleteConfirmDs.id
    setDatasources(prev => prev.filter(ds => ds.id !== id))
    if (selectedDsId === id) setSelectedDsId(null)
    setDeleteConfirmDs(null)
  }

  return (
    <AppLayout>
      {/* Top bar */}
      <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-gray-200 dark:border-white/8 bg-white dark:bg-[#13131a]">
        <h1 className="text-gray-900 dark:text-white font-semibold text-lg">Datasources</h1>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative hidden sm:block">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search collections..."
              className="w-56 pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/8 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
          </div>
          {/* Create button */}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Datasource
          </button>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Total Datasources"
            value={datasources.length}
            iconBg="bg-blue-50 dark:bg-blue-500/15"
            icon={
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3V7M4 7c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3M4 7c0-2 1.5-3 4-3h8c2.5 0 4 1 4 3" />
              </svg>
            }
          />
          <StatCard
            label="Total Documents"
            value={totalDocs.toLocaleString()}
            iconBg="bg-emerald-50 dark:bg-emerald-500/15"
            icon={
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
          <StatCard
            label="Storage Used"
            value="2.4 GB"
            iconBg="bg-violet-50 dark:bg-violet-500/15"
            icon={
              <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            }
          />
        </div>

        {/* Datasources */}
        <h2 className="text-gray-900 dark:text-white font-semibold text-base mb-4">My Datasources</h2>
        {filtered.length === 0 && search ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">No collections match "{search}"</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(ds => (
              <CollectionCard
                key={ds.id}
                ds={ds}
                onClick={() => setSelectedDsId(ds.id)}
                onDelete={() => handleDeleteDs(ds)}
              />
            ))}
            <CreateCard onClick={() => setShowCreate(true)} />
          </div>
        )}
      </main>

      {/* Create datasource panel */}
      {showCreate && (
        <CreateDatasourcePanel
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Datasource detail panel */}
      {activePanelDs && (
        <DatasourceDetailPanel
          ds={activePanelDs}
          onClose={() => setSelectedDsId(null)}
          onUpload={handleUpload}
          onDeleteDoc={handleDeleteDoc}
          onDeleteDatasource={() => handleDeleteDs(activePanelDs)}
        />
      )}

      {/* Delete confirm modal */}
      {deleteConfirmDs && (
        <DeleteDatasourceModal
          ds={deleteConfirmDs}
          onClose={() => setDeleteConfirmDs(null)}
          onConfirm={confirmDeleteDs}
        />
      )}
    </AppLayout>
  )
}
