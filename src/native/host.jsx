// WHAT ONLY THE APP CAN DO FOR A SCREEN — the camera, the gallery, the phone's
// files, the phone's own date picker, reading a barcode — as the `host` every
// <NativeScreen> takes:
//
//   pickFile({ camera, multiple, accept }) → [{ uri, name, type, size }]  (uploaded by the screen)
//   pickDate({ mode: 'date' | 'datetime', value }) → 'YYYY-MM-DD' | 'YYYY-MM-DDTHH:mm' | null
//   scanCode({ title, note, many }) → the code the camera read, or null (Done / Back)
//   baseUrl  the server, for a picture the server names by a path of its own
//
// The Expo modules are HANDED IN, not imported: this package depends on no
// Expo module, so a web app installs nothing, and a phone app installs only
// the ones it uses. Any left out, that ability is left out (a date is typed,
// a file not picked, no Scan):
//
//   import * as ImagePicker from 'expo-image-picker'
//   import * as DocumentPicker from 'expo-document-picker'
//   import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
//   import { CameraView, Camera } from 'expo-camera'
//   <NativeHostProvider modules={{ ImagePicker, DocumentPicker, DateTimePicker, DateTimePickerAndroid, CameraView, Camera }}
//                       baseUrl={server} appName="Rental Desk">…</NativeHostProvider>
//   const host = useNativeHost()
//
// A date is the phone's own time. On Android the picker is the system dialog
// (date, then time); on iOS a sheet with the wheel.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Modal, Platform, StyleSheet, Text, View } from 'react-native'
import { Btn } from './parts.jsx'
import { useNativeTheme } from './theme.js'

const HostContext = createContext(null)

const pad = (n) => String(n).padStart(2, '0')
const asDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const asMoment = (d) => `${asDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
function parse(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(v || ''))
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 9), Number(m[5] || 0)) : new Date()
}

/** Pictures only, when every allowed extension is a picture's. */
export function picturesOnly(accept) {
  const list = String(accept || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  return list.length > 0 && list.every((e) => /^\.?(jpe?g|png|gif|webp|heic|heif)$/.test(e))
}

const fromImage = (a, i) => ({ uri: a.uri, name: a.fileName || `photo-${Date.now()}-${i}.jpg`, type: a.mimeType || 'image/jpeg', size: a.fileSize })
const fromDocument = (a) => ({ uri: a.uri, name: a.name, type: a.mimeType || 'application/octet-stream', size: a.size })

// The codes printed on labels — shop barcodes, rack labels — and QR codes.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'codabar', 'qr']

/** The camera, reading one code — until a code is read or Done / Back. */
function Scanner({ CameraView, title, note, onCode, onClose }) {
  const t = useNativeTheme()
  const read = useRef(false)
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
                    onBarcodeScanned={(r) => { if (read.current || !r || !r.data) return; read.current = true; onCode(String(r.data)) }} />
        <View style={{ position: 'absolute', top: 48, left: 16, right: 16, padding: 12, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{title || 'Scan'}</Text>
          <Text style={{ color: '#ddd', marginTop: 4 }}>{note ? `${note} — scan the next, or Done` : 'Point the camera at the barcode'}</Text>
        </View>
        <View style={{ position: 'absolute', top: '40%', left: '12%', right: '12%', height: 140, borderWidth: 2, borderColor: t.accent, borderRadius: 12 }} />
        <View style={{ position: 'absolute', bottom: 40, left: 16, right: 16 }}>
          <Btn label="Done" variant="primary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  )
}

export function NativeHostProvider({ modules = {}, baseUrl = '', appName = 'this app', children }) {
  const t = useNativeTheme()
  const { ImagePicker, DocumentPicker, DateTimePicker, DateTimePickerAndroid, CameraView, Camera } = modules
  const [asking, setAsking] = useState(null)   // iOS: { mode, value }
  const answer = useRef(null)
  const allowCamera = `Allow the camera for ${appName} in the phone's settings`

  const pickFile = useCallback(async ({ camera, multiple, accept }) => {
    if (camera) {
      const ok = await ImagePicker.requestCameraPermissionsAsync()
      if (!ok.granted) throw new Error(allowCamera)
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.7 })
      return r.canceled ? [] : r.assets.map(fromImage)
    }
    if (picturesOnly(accept) || !DocumentPicker) {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7, allowsMultipleSelection: Boolean(multiple) })
      return r.canceled ? [] : r.assets.map(fromImage)
    }
    const r = await DocumentPicker.getDocumentAsync({ multiple: Boolean(multiple), copyToCacheDirectory: true })
    return r.canceled ? [] : r.assets.map(fromDocument)
  }, [ImagePicker, DocumentPicker, allowCamera])

  const androidPick = useCallback((mode, value) => new Promise((resolve) => {
    DateTimePickerAndroid.open({ value, mode, is24Hour: false, onChange: (event, date) => resolve(event.type === 'set' && date ? date : null) })
  }), [DateTimePickerAndroid])

  const pickDate = useCallback(async ({ mode, value }) => {
    const start = parse(value)
    if (Platform.OS === 'android') {
      const day = await androidPick('date', start)
      if (!day) return null
      if (mode !== 'datetime') return asDay(day)
      const time = await androidPick('time', day)
      if (!time) return null
      day.setHours(time.getHours(), time.getMinutes(), 0, 0)
      return asMoment(day)
    }
    return new Promise((resolve) => { answer.current = resolve; setAsking({ mode, value: start }) })
  }, [androidPick])

  const finish = (date) => {
    const resolve = answer.current
    answer.current = null
    const mode = asking && asking.mode
    setAsking(null)
    if (resolve) resolve(date ? (mode === 'datetime' ? asMoment(date) : asDay(date)) : null)
  }

  const [scanning, setScanning] = useState(null)
  const scanAnswer = useRef(null)
  const scanCode = useCallback(async ({ title, note, many } = {}) => {
    const ok = await Camera.requestCameraPermissionsAsync()
    if (!ok.granted) throw new Error(allowCamera)
    return new Promise((resolve) => { scanAnswer.current = resolve; setScanning({ title, note, many }) })
  }, [Camera, allowCamera])
  const scanned = (code) => {
    const resolve = scanAnswer.current
    scanAnswer.current = null
    setScanning(null)
    if (resolve) resolve(code)
  }

  // In a browser (Expo's web build) dates are typed and files picked by the screen's own fallbacks.
  const host = useMemo(() => {
    if (Platform.OS === 'web') return { baseUrl }
    const h = { baseUrl }
    if (ImagePicker) h.pickFile = pickFile
    if (DateTimePicker && DateTimePickerAndroid) h.pickDate = pickDate
    if (CameraView && Camera) h.scanCode = scanCode
    return h
  }, [baseUrl, ImagePicker, DateTimePicker, DateTimePickerAndroid, CameraView, Camera, pickFile, pickDate, scanCode])

  return (
    <HostContext.Provider value={host}>
      {children}
      {scanning && CameraView ? <Scanner CameraView={CameraView} {...scanning} onCode={scanned} onClose={() => scanned(null)} /> : null}
      {asking && DateTimePicker ? (
        <Modal transparent animationType="slide" onRequestClose={() => finish(null)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ backgroundColor: t.surface, padding: 16, paddingBottom: 32 }}>
              <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>{asking.mode === 'datetime' ? 'Pick a date and time' : 'Pick a date'}</Text>
              <DateTimePicker value={asking.value} mode={asking.mode} display="spinner"
                              onChange={(event, date) => { if (date) setAsking((a) => ({ ...a, value: date })) }} />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <Btn label="Cancel" onPress={() => finish(null)} />
                <Btn label="Done" variant="primary" onPress={() => finish(asking.value)} />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </HostContext.Provider>
  )
}

/** The host every screen in the app is given. */
export function useNativeHost() {
  return useContext(HostContext)
}
