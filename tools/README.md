# Asset pipeline

Python 3 with `pillow`, `opencv-python-headless` and `numpy`. `sr.py` also needs `torch`, plus Real-ESRGAN weights
(`RealESRGAN_x4plus.pth`) from https://github.com/xinntao/Real-ESRGAN/releases.

- `prep.py`: crops placeholder art from the two reference mockups and inpaints baked-in labels and text
- `sr.py`: 4× super-resolution for every PNG in a folder
- `build-assets.py`: composes the base, district layers, balloon sprite, clouds, banners and thumbnails into `public/`

See the root README for usage.
