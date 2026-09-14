import { useState } from 'react'
import { XeplrCanvas } from '@xeplr/ui-canvas'
import ControlView from './ControlView.jsx'
import Palette, { DRAG_TYPE } from './Palette.jsx'
import PropertyPanel from './PropertyPanel.jsx'

// The builder, drawn: name and Save on top, controls on the left, the screen
// on the canvas in the middle, the selection's properties on the right.
// Presentation only — everything comes from useFactoryBuilder.
//
// The canvas is @xeplr/ui-canvas in fraction units with pageAspect set to the
// screen's aspect, which is exactly the geometry ScreenSample renders with — so
// the builder shows the screen at its real proportions.

export default function BuilderSample({ ctrl, renderPreview, className, style }) {
  const { document: doc } = ctrl
  const [preview, setPreview] = useState(false)
  const problemCount = ctrl.validation.errors.length

  function onDrop(e) {
    const type = e.dataTransfer.getData(DRAG_TYPE) || e.dataTransfer.getData('text/plain')
    const def = ctrl.controls[type]
    if (!def) return
    e.preventDefault()
    const inner = e.currentTarget.querySelector('.xeplr-canvas-inner')
    if (!inner) return ctrl.addControl(type)
    const rect = inner.getBoundingClientRect()
    const pageH = rect.width * doc.aspect
    // The pointer is the control's CENTRE — dropping a wide field by its
    // top-left corner puts it somewhere you did not point at.
    ctrl.addControl(type, {
      x: (e.clientX - rect.left) / rect.width - def.defaultSize.w / 2,
      y: (e.clientY - rect.top) / pageH - def.defaultSize.h / 2
    })
  }

  return (
    <div className={'xeplr-factory-builder' + (className ? ' ' + className : '')} style={style}>
      <header className="xeplr-factory-bar">
        <input
          className="xeplr-factory-name"
          value={doc.name}
          onChange={(e) => ctrl.rename(e.target.value)}
          placeholder="Screen name, e.g. New employee"
          aria-label="Screen name"
        />
        <div className="xeplr-factory-bar-status" aria-live="polite">
          {ctrl.saving ? 'Saving…' : ctrl.dirty ? 'Unsaved changes' : ''}
        </div>
        {problemCount > 0 && (
          <span className={`xeplr-factory-problems${ctrl.showErrors ? ' is-loud' : ''}`} title={ctrl.validation.errors.map((x) => `${x.path}: ${x.message}`).join('\n')}>
            {problemCount} problem{problemCount === 1 ? '' : 's'}
          </span>
        )}
        {renderPreview && (
          <button type="button" className="xeplr-factory-secondary" aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
            {preview ? 'Back to design' : 'Preview'}
          </button>
        )}
        <button type="button" className="xeplr-factory-primary" onClick={ctrl.save} disabled={ctrl.saving}>
          Save
        </button>
      </header>

      {ctrl.saveError && <div className="xeplr-factory-save-error" role="alert">{ctrl.saveError}</div>}
      {ctrl.showErrors && ctrl.errorsByNode._document && (
        <div className="xeplr-factory-save-error" role="alert">
          {ctrl.errorsByNode._document.map((e, i) => <div key={i}><code>{e.path}</code> {e.message}</div>)}
        </div>
      )}

      {preview && renderPreview ? (
        <div className="xeplr-factory-preview">{renderPreview(doc)}</div>
      ) : (
        <div className="xeplr-factory-body">
          <Palette groups={ctrl.palette} onAdd={(type) => ctrl.addControl(type)} />

          <div
            className="xeplr-factory-stage"
            onDragOver={(e) => { if ([...e.dataTransfer.types].includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
            onDrop={onDrop}
          >
            <XeplrCanvas
              className="xeplr-factory-canvas"
              items={doc.nodes}
              units="fraction"
              pageAspect={doc.aspect}
              features={{ resize: true, marquee: true }}
              selection={ctrl.selected}
              onSelectionChange={ctrl.setSelected}
              onItemChange={ctrl.moveControl}
              minSizeFor={() => ({ minWidth: 16, minHeight: 12 })}
              renderItem={(node, { selected }) => (
                <div className={`xeplr-factory-design-node${ctrl.showErrors && ctrl.errorsByNode[node.id] ? ' has-error' : ''}${selected ? ' is-selected' : ''}`}>
                  <ControlView node={node} mode="design" />
                </div>
              )}
              underlay={doc.nodes.length === 0 && (
                <div className="xeplr-factory-empty">Drag controls here from the left</div>
              )}
            />
          </div>

          <PropertyPanel
            node={ctrl.selectedNode}
            control={ctrl.selectedControl}
            selectionCount={ctrl.selected.size}
            errors={ctrl.selectedNode ? ctrl.errorsByNode[ctrl.selectedNode.id] : null}
            tables={ctrl.tables}
            onChange={(path, value) => ctrl.setProperty(ctrl.selectedNode.id, path, value)}
            onRemove={ctrl.removeSelected}
          />
        </div>
      )}
    </div>
  )
}
