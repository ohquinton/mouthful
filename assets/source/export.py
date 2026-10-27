import sys
from PIL import Image, ImageDraw
out = sys.argv[1]
SS = 4
BARS = [  # x, y, w, h, colour, alpha (mono alpha)
 (160,232,340,128,'#FFFFFF',1.0,0.6),(564,232,300,128,'#FFFFFF',1.0,0.6),
 (160,448,220,128,'#FFFFFF',1.0,0.6),(444,432,420,160,'#E3A33A',1.0,1.0),
 (160,664,420,128,'#FFFFFF',0.35,0.28),(644,664,220,128,'#FFFFFF',0.35,0.28)]
COBALT = '#2F49F5'
def hexrgb(h): return tuple(int(h[i:i+2],16) for i in (1,3,5))
def render(size, bg=True, scale=1.0, mono=False, rounded=0.0):
    N = 1024*SS
    img = Image.new('RGBA',(N,N),(0,0,0,0))
    if bg:
        layer = Image.new('RGBA',(N,N),(0,0,0,0))
        ImageDraw.Draw(layer).rounded_rectangle([0,0,N-1,N-1], radius=int(N*rounded), fill=hexrgb(COBALT)+(255,))
        img = Image.alpha_composite(img, layer)
    for x,y,w,h,c,a,ma in BARS:
        cx = lambda v: (512 + (v-512)*scale)*SS
        x0,y0,x1,y1 = cx(x),cx(y),cx(x+w),cx(y+h)
        layer = Image.new('RGBA',(N,N),(0,0,0,0))
        col = (0,0,0) if mono else hexrgb(c)
        alpha = ma if mono else a
        ImageDraw.Draw(layer).rounded_rectangle([x0,y0,x1,y1], radius=(y1-y0)/2, fill=col+(int(255*alpha),))
        img = Image.alpha_composite(img, layer)
    return img.resize((size,size), Image.LANCZOS)
render(1024).convert('RGB').save(f'{out}/icon.png')                     # iOS: opaque, square
render(1024, bg=False, scale=0.62).save(f'{out}/android-icon-foreground.png')
Image.new('RGBA',(1024,1024),hexrgb(COBALT)+(255,)).save(f'{out}/android-icon-background.png')
render(1024, bg=False, scale=0.62, mono=True).save(f'{out}/android-icon-monochrome.png')
render(1024, rounded=0.225).save(f'{out}/splash-icon.png')
render(48, rounded=0.225).save(f'{out}/favicon.png')
