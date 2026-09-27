"""4x super-resolution with Real-ESRGAN (weights from github.com/xinntao/Real-ESRGAN releases).

Usage: SR_WEIGHTS=<dir> python3 tools/sr.py plus|general <in-dir> <out-dir>
"""
import os, sys, torch, torch.nn as nn, torch.nn.functional as F, numpy as np
from PIL import Image

D = os.environ.get('SR_WEIGHTS', 'tools/.cache').rstrip('/') + '/'


class SRVGG(nn.Module):
    def __init__(s, nf=64, nc=32, up=4):
        super().__init__()
        s.up = up
        b = [nn.Conv2d(3, nf, 3, 1, 1), nn.PReLU(nf)]
        for _ in range(nc):
            b += [nn.Conv2d(nf, nf, 3, 1, 1), nn.PReLU(nf)]
        b += [nn.Conv2d(nf, 3 * up * up, 3, 1, 1)]
        s.body = nn.Sequential(*b)
        s.ups = nn.PixelShuffle(up)

    def forward(s, x):
        return s.ups(s.body(x)) + F.interpolate(x, scale_factor=s.up, mode='nearest')


class RDB(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__()
        s.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
        s.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        s.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        s.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        s.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
        s.l = nn.LeakyReLU(0.2, True)

    def forward(s, x):
        x1 = s.l(s.conv1(x)); x2 = s.l(s.conv2(torch.cat((x, x1), 1)))
        x3 = s.l(s.conv3(torch.cat((x, x1, x2), 1))); x4 = s.l(s.conv4(torch.cat((x, x1, x2, x3), 1)))
        return s.conv5(torch.cat((x, x1, x2, x3, x4), 1)) * 0.2 + x


class RRDB(nn.Module):
    def __init__(s):
        super().__init__()
        s.rdb1, s.rdb2, s.rdb3 = RDB(), RDB(), RDB()

    def forward(s, x):
        return s.rdb3(s.rdb2(s.rdb1(x))) * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(s, nb=23):
        super().__init__()
        s.conv_first = nn.Conv2d(3, 64, 3, 1, 1)
        s.body = nn.Sequential(*[RRDB() for _ in range(nb)])
        s.conv_body = nn.Conv2d(64, 64, 3, 1, 1)
        s.conv_up1 = nn.Conv2d(64, 64, 3, 1, 1)
        s.conv_up2 = nn.Conv2d(64, 64, 3, 1, 1)
        s.conv_hr = nn.Conv2d(64, 64, 3, 1, 1)
        s.conv_last = nn.Conv2d(64, 3, 3, 1, 1)
        s.l = nn.LeakyReLU(0.2, True)

    def forward(s, x):
        f = s.conv_first(x)
        f = f + s.conv_body(s.body(f))
        f = s.l(s.conv_up1(F.interpolate(f, scale_factor=2, mode='nearest')))
        f = s.l(s.conv_up2(F.interpolate(f, scale_factor=2, mode='nearest')))
        return s.conv_last(s.l(s.conv_hr(f)))


def load(kind):
    if kind == 'plus':
        m = RRDBNet(); sd = torch.load(D + 'RealESRGAN_x4plus.pth', map_location='cpu')
    else:
        m = SRVGG(); sd = torch.load(D + 'realesr-general-x4v3.pth', map_location='cpu')
    sd = sd.get('params_ema', sd.get('params', sd))
    m.load_state_dict(sd); m.eval()
    return m


@torch.no_grad()
def upscale(m, img, tile=192, pad=12):
    a = torch.from_numpy(np.asarray(img.convert('RGB')).astype(np.float32) / 255).permute(2, 0, 1)[None]
    _, _, h, w = a.shape
    out = torch.zeros(1, 3, h * 4, w * 4)
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            y0, x0 = max(y - pad, 0), max(x - pad, 0)
            y1, x1 = min(y + tile + pad, h), min(x + tile + pad, w)
            o = m(a[:, :, y0:y1, x0:x1])
            ty, tx = min(tile, h - y), min(tile, w - x)
            out[:, :, y * 4:(y + ty) * 4, x * 4:(x + tx) * 4] = \
                o[:, :, (y - y0) * 4:(y - y0 + ty) * 4, (x - x0) * 4:(x - x0 + tx) * 4]
    o = (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)
    return Image.fromarray(o)


if __name__ == '__main__':
    kind, src, dst = sys.argv[1:4]
    m = load(kind)
    os.makedirs(dst, exist_ok=True)
    for f in sorted(os.listdir(src)):
        if f.endswith('.png'):
            upscale(m, Image.open(os.path.join(src, f))).save(os.path.join(dst, f))
            print(f, flush=True)
