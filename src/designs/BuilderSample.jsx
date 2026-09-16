import { useState } from 'react'
import { XeplrCanvas } from '@xeplr/ui-canvas'
import ControlView from './ControlView.jsx'
import Palette, { DRAG_TYPE } from './Palette.jsx'
import PropertyPanel from './PropertyPanel.jsx'
import { screenStyle } from './styles.js'

// The builder, drawn: name and save status on top, controls on the left, the
// screen on the canvas in the middle, properties on the right — the selected
// control's, or the screen's own when nothing is selected. Presentation only —
// everything comes from useFactoryBuilder.
//
// The canvas is exactly the screen's design width (never wider), in fraction
// units with pageAspect = the screen's aspect: the same geometry ScreenSample
// renders with, so the builder shows the screen at its real size.

const STATUS = {
  idle: '',
  pending: 'Unsaved changes…',
  saving: 'Saving…',
  saved: 'All changes saved',
  invalid: 'Not saved — fix the problems',
  error: 'Not saved'
}

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
        <div className={`xeplr-factory-bar-status xeplr-factory-bar-status--${ctrl.status}`} role="status" aria-live="polite">
          {ctrl.status === 'error' ? `Not saved — ${ctrl.saveError}` : STATUS[ctrl.status]}
        </div>
        {problemCount > 0 && (
          <span className="xeplr-factory-problems" title={ctrl.validation.errors.map((x) => `${x.path}: ${x.message}`).join('\n')}>
            {problemCount} problem{problemCount === 1 ? '' : 's'}
          </span>
        )}
        {ctrl.status === 'error' && (
          <button type="button" className="xeplr-factory-secondary" onClick={ctrl.save}>Retry</button>
        )}
        {renderPreview && (
          <button type="button" className="xeplr-factory-secondary" aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
            {preview ? 'Back to design' : 'Preview'}
          </button>
        )}
        {ctrl.canPublish && (
          <button type="button" className="xeplr-factory-primary" onClick={() => ctrl.publish()} disabled={ctrl.publishing}>
            {ctrl.publishing ? 'Publishing…' : 'Publish'}
          </button>
        )}
      </header>

      {ctrl.publishResult && ctrl.publishResult.confirm && (
        <div className="xeplr-factory-publish is-confirm" role="alertdialog" aria-label="Confirm removing columns">
          <div className="xeplr-factory-confirm-text">
            <strong>Publishing removes {ctrl.publishResult.confirm.length === 1 ? 'a column' : `${ctrl.publishResult.confirm.length} columns`} and all the data in {ctrl.publishResult.confirm.length === 1 ? 'it' : 'them'}.</strong>
            <ul>
              {ctrl.publishResult.confirm.map((c) => (
                <li key={c.column}><code>{c.column}</code> — {c.records} saved value{c.records === 1 ? '' : 's'}, for every company using this table</li>
              ))}
            </ul>
            This cannot be undone. To keep the data, put the field back before publishing.
          </div>
          <div className="xeplr-factory-confirm-actions">
            <button type="button" className="xeplr-factory-danger" disabled={ctrl.publishing}
              onClick={() => ctrl.publish(ctrl.publishResult.confirm.map((c) => c.column))}>
              {ctrl.publishing ? 'Publishing…' : 'Remove and publish'}
            </button>
            <button type="button" className="xeplr-factory-secondary" onClick={ctrl.clearPublishResult}>Cancel</button>
          </div>
        </div>
      )}
      {ctrl.publishResult && !ctrl.publishResult.confirm && (
        <div className={`xeplr-factory-publish${ctrl.publishResult.ok ? ' is-ok' : ' is-error'}`} role="status">
          <span>{ctrl.publishResult.message}</span>
          {ctrl.publishResult.detail && <pre className="xeplr-factory-publish-detail">{ctrl.publishResult.detail}</pre>}
          <button type="button" className="xeplr-factory-icon-button" aria-label="Dismiss" onClick={ctrl.clearPublishResult}>×</button>
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
            {ctrl.steps.building && (
              <div className="xeplr-factory-building" style={{ maxWidth: doc.width }}>
                <span className="xeplr-factory-building-what">Building</span>
                {ctrl.steps.labels(ctrl.steps.building).map((s2, i) => (
                  <button
                    key={s2.key}
                    type="button"
                    className={'xeplr-factory-building-step' + (i === ctrl.steps.active(ctrl.steps.building) ? ' is-active' : '')}
                    onClick={() => ctrl.steps.go(ctrl.steps.building, i)}
                  >
                    {s2.label}
                  </button>
                ))}
                {ctrl.selectedNode && ctrl.selectedNode.type !== 'stepper' && (
                  <label className="xeplr-factory-building-every">
                    <input
                      type="checkbox"
                      checked={!ctrl.steps.of(ctrl.selectedNode)}
                      onChange={(e) => ctrl.steps.set(ctrl.selectedNode.id, e.target.checked ? null : { of: ctrl.steps.building, index: ctrl.steps.active(ctrl.steps.building) })}
                    />
                    <span>Show the selected control on every step</span>
                  </label>
                )}
              </div>
            )}
            <div className="xeplr-factory-frame" style={{ maxWidth: doc.width }}>
              <XeplrCanvas
                className="xeplr-factory-canvas"
                style={screenStyle(doc)}
                items={ctrl.visibleNodes}
                units="fraction"
                pageAspect={doc.aspect}
                features={{ resize: true, marquee: true }}
                selection={ctrl.selected}
                onSelectionChange={ctrl.setSelected}
                onItemChange={ctrl.moveControl}
                minSizeFor={() => ({ minWidth: 16, minHeight: 12 })}
                renderItem={(node, { selected }) => (
                  <div className={`xeplr-factory-design-node${ctrl.errorsByNode[node.id] ? ' has-error' : ''}${selected ? ' is-selected' : ''}`}>
                    <ControlView
                      node={node}
                      mode="design"
                      list={node.type === 'list' ? { doc } : undefined}
                      // Clicking a step on the canvas OPENS it: the canvas then
                      // shows that step's controls, and what you drop joins them.
                      stepper={node.type === 'stepper' ? { active: ctrl.steps.active(node.id), onStep: (i) => ctrl.steps.go(node.id, i) } : undefined}
                    />
                  </div>
                )}
                underlay={ctrl.visibleNodes.length === 0 && (
                  <div className="xeplr-factory-empty">
                    {doc.nodes.length === 0 ? 'Drag controls here from the left' : 'This step is empty — drop a control to start it'}
                  </div>
                )}
              />
            </div>
          </div>

          <PropertyPanel
            doc={doc}
            node={ctrl.selectedNode}
            control={ctrl.selectedControl}
            selectionCount={ctrl.selected.size}
            errors={ctrl.selectedNode ? ctrl.errorsByNode[ctrl.selectedNode.id] : ctrl.errorsByNode._document}
            tables={ctrl.tables}
            screens={ctrl.screens}
            lockedNames={ctrl.lockedNames}
            onChange={(path, value) => ctrl.setProperty(ctrl.selectedNode.id, path, value)}
            onScreenChange={ctrl.setScreen}
            onRemove={ctrl.removeSelected}
          />
        </div>
      )}
    </div>
  )
}
