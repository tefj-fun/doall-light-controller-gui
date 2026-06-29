# DoAll Light Controller GUI

Local React and Node GUI for controlling a Smart Vision Lights / DoAll DLM controller over TCP.

The app mimics the core URCap flow:

- Connect to the controller
- Configure light modes and channels
- Run, stop, and strobe the current event
- Control solid color, color mixed ring, dark field, IR, dome, auxiliary, and digital outputs

## Controller Defaults

The local bridge defaults to:

- Controller host: `192.168.1.200`
- Controller TCP port: `9019`
- GUI URL: `http://127.0.0.1:5178`

Override these with environment variables:

```bash
DOALL_HOST=192.168.1.200 DOALL_PORT=9019 PORT=5178 npm run dev
```

## Mac Ethernet Setup

For direct USB-C Ethernet control, set the Mac adapter to the same subnet as the controller. The controller expects the Mac at `192.168.1.150/24`.

Example:

```bash
sudo ifconfig en10 alias 192.168.1.150 255.255.255.0
```

Replace `en10` with the actual adapter name if different.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5178
```

## Validate

Protocol smoke test:

```bash
npm run test:protocol
```

Production build:

```bash
npm run build
```

## Notes

- `101` is used as the controller's off sentinel for light-channel fields.
- Solid color selection uses `wrgbselect`: white `0`, red `1`, green `2`, blue `3`.
- Dark field selection uses `dfselect`: both `0`, near `1`, far `2`.
- Slider edits update the UI immediately and commit one controller command on release, blur, or Enter to avoid visible flicker.
