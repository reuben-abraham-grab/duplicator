import React, { useState, useRef, useEffect } from 'react';
import type { DragEvent } from 'react';
import { Box, Button, List, ListItem, ListItemText, Paper, Typography, TextField, InputAdornment, IconButton, Divider, Switch, FormControlLabel } from '@mui/material';
import { toPng } from 'html-to-image';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';

interface ImageInfo {
  id: string;
  href: string;
  element: SVGImageElement;
}

// Helper to set favicon from image url
const setFavicon = (url: string) => {
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
};

const SVGEditor: React.FC = () => {
  const [svgContent, setSvgContent] = useState<string>('');
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [svgNaturalWidth, setSvgNaturalWidth] = useState<number>(800);
  const [svgNaturalHeight, setSvgNaturalHeight] = useState<number>(600);
  const [exportWidth, setExportWidth] = useState<number>(800);
  const [exportHeight, setExportHeight] = useState<number>(600);
  const [aspectLocked, setAspectLocked] = useState<boolean>(true);
  const [svgDragActive, setSvgDragActive] = useState(false);
  const [imageDragActive, setImageDragActive] = useState<string | null>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const aspectRatio = svgNaturalWidth / svgNaturalHeight;
  const [originalSvgContent, setOriginalSvgContent] = useState<string>('');

  // Helper to inject outline rect into SVG (for UI preview only)
  const injectOutlineRect = (svgString: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (svg) {
      // Remove any previous outline rect
      const prev = svg.querySelector('rect[data-duplicator-outline]');
      if (prev) svg.removeChild(prev);
      // Get width/height from attributes or viewBox
      let width = svg.getAttribute('width');
      let height = svg.getAttribute('height');
      let w = width ? parseFloat(width) : undefined;
      let h = height ? parseFloat(height) : undefined;
      if ((!w || !h) && svg.getAttribute('viewBox')) {
        const vb = svg.getAttribute('viewBox')!.split(/\s+/);
        if (vb.length === 4) {
          w = parseFloat(vb[2]);
          h = parseFloat(vb[3]);
        }
      }
      if (w && h) {
        const outline = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
        outline.setAttribute('x', '0');
        outline.setAttribute('y', '0');
        outline.setAttribute('width', w.toString());
        outline.setAttribute('height', h.toString());
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', '#b91c1c'); // deep red
        outline.setAttribute('stroke-width', '3');
        outline.setAttribute('data-duplicator-outline', 'true');
        outline.setAttribute('pointer-events', 'none');
        svg.appendChild(outline);
      }
    }
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  };

  useEffect(() => {
    // When svgContent changes, try to extract width/height from SVG and set preserveAspectRatio for all images
    if (svgContent) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (svg) {
        let width = svg.getAttribute('width');
        let height = svg.getAttribute('height');
        let viewBox = svg.getAttribute('viewBox');
        if (width && height) {
          const w = parseFloat(width);
          const h = parseFloat(height);
          if (!isNaN(w) && !isNaN(h)) {
            setSvgNaturalWidth(w);
            setSvgNaturalHeight(h);
            setExportWidth(w);
            setExportHeight(h);
          }
        } else if (viewBox) {
          const vb = viewBox.split(/\s+/);
          if (vb.length === 4) {
            const w = parseFloat(vb[2]);
            const h = parseFloat(vb[3]);
            if (!isNaN(w) && !isNaN(h)) {
              setSvgNaturalWidth(w);
              setSvgNaturalHeight(h);
              setExportWidth(w);
              setExportHeight(h);
            }
          }
        }
      }
      // Set preserveAspectRatio for all images
      const imageElements = doc.getElementsByTagName('image');
      Array.from(imageElements).forEach((img) => {
        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      });
      // Update svgContent with new preserveAspectRatio
      const serializer = new XMLSerializer();
      setSvgContent(serializer.serializeToString(doc));
    }
    // eslint-disable-next-line
  }, [svgContent]);

  // On SVG upload, set favicon to the uploaded SVG file itself
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setSvgContent(content);
        setOriginalSvgContent(content); // store original
        extractImages(content, true);
        // Set favicon to the uploaded SVG file as data URL
        const svgReader = new FileReader();
        svgReader.onload = (ev) => {
          setFavicon(ev.target?.result as string);
        };
        svgReader.readAsDataURL(file);
      };
      reader.readAsText(file);
    }
  };

  // Drag-and-drop for SVG upload (now on SVG preview area)
  const handleSvgDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setSvgDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          setSvgContent(content);
          extractImages(content);
        };
        reader.readAsText(file);
      }
    }
  };
  const handleSvgDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setSvgDragActive(true);
  };
  const handleSvgDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setSvgDragActive(false);
  };

  const extractImages = (svgString: string, setFaviconFromImage = false) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const imageElements = doc.getElementsByTagName('image');
    const imageList: ImageInfo[] = [];

    Array.from(imageElements).forEach((img, index) => {
      // Try href, xlink:href, and getAttributeNS
      let href = img.getAttribute('href');
      if (!href) {
        href = img.getAttribute('xlink:href');
      }
      if (!href) {
        href = img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      }
      // Always set preserveAspectRatio for all images
      img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      imageList.push({
        id: `image-${index}`,
        href: href || '',
        element: img as SVGImageElement,
      });
    });

    setImages(imageList);
    if (setFaviconFromImage && imageList.length > 0 && imageList[0].href) {
      setFavicon(imageList[0].href);
    }
  };

  // Drag-and-drop for image replacement (multiple images)
  const handleImageListDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setImageDragActive(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')).slice(0, 3);
      console.log('Dropped files:', files.map(f => f.name));
      if (!svgContent) return;
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      const imageElements = doc.getElementsByTagName('image');
      files.forEach((file, idx) => {
        if (imageElements[idx]) {
          const url = URL.createObjectURL(file);
          console.log(`Replacing image ${idx} (image-${idx}) with file:`, file.name);
          imageElements[idx].setAttribute('href', url);
          imageElements[idx].setAttribute('preserveAspectRatio', 'xMidYMid slice');
          // Set favicon to the last uploaded image file
          if (idx === files.length - 1) {
            const reader = new FileReader();
            reader.onload = (e) => {
              setFavicon(e.target?.result as string);
            };
            reader.readAsDataURL(file);
          }
        } else {
          console.log(`No SVG image at index ${idx} to replace.`);
        }
      });
      const serializer = new XMLSerializer();
      const newSvgContent = serializer.serializeToString(doc);
      setSvgContent(newSvgContent);
      extractImages(newSvgContent);
    }
  };
  const handleImageListDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setImageDragActive('list');
  };
  const handleImageListDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setImageDragActive(null);
  };

  // Drag-and-drop for single image replacement
  const handleImageDrop = (e: DragEvent<HTMLDivElement>, imageId: string) => {
    e.preventDefault();
    setImageDragActive(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        handleImageReplace(imageId, url, file);
      }
    }
  };
  const handleImageDragOver = (e: DragEvent<HTMLDivElement>, imageId: string) => {
    e.preventDefault();
    setImageDragActive(imageId);
  };
  const handleImageDragLeave = (e: DragEvent<HTMLDivElement>, imageId: string) => {
    e.preventDefault();
    setImageDragActive(null);
  };

  const handleImageReplace = (imageId: string, newImageUrl: string, file?: File) => {
    if (svgContainerRef.current) {
      const svgDoc = svgContainerRef.current.querySelector('svg');
      if (svgDoc) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const imageElements = doc.getElementsByTagName('image');
        const targetImage = Array.from(imageElements).find((img, index) => `image-${index}` === imageId);
        if (targetImage) {
          targetImage.setAttribute('href', newImageUrl);
          targetImage.setAttribute('preserveAspectRatio', 'xMidYMid slice');
          const serializer = new XMLSerializer();
          const newSvgContent = serializer.serializeToString(doc);
          setSvgContent(newSvgContent);
          setImages(prevImages =>
            prevImages.map(img =>
              img.id === imageId ? { ...img, href: newImageUrl } : img
            )
          );
          // Set favicon to the uploaded image file
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              setFavicon(e.target?.result as string);
            };
            reader.readAsDataURL(file);
          }
        }
      }
    }
  };

  // Aspect ratio lock handlers
  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      setExportWidth(value);
      if (aspectLocked) {
        setExportHeight(Math.round(value / aspectRatio));
      }
    }
  };
  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      setExportHeight(value);
      if (aspectLocked) {
        setExportWidth(Math.round(value * aspectRatio));
      }
    }
  };

  const handleAspectLockToggle = () => {
    setAspectLocked((prev) => !prev);
  };

  // For PNG export, use the SVG without the red outline
  const svgForExport = svgContent;
  const svgWithOutline = svgContent ? injectOutlineRect(svgContent) : '';

  const handleDownload = async () => {
    if (svgContainerRef.current) {
      try {
        // Create a temporary DOM node for export without the red outline
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = svgForExport;
        const svgNode = tempDiv.querySelector('svg');
        if (svgNode) {
          const originalWidth = svgNode.getAttribute('width');
          const originalHeight = svgNode.getAttribute('height');
          svgNode.setAttribute('width', exportWidth.toString());
          svgNode.setAttribute('height', exportHeight.toString());
          const dataUrl = await toPng(svgNode as unknown as HTMLElement, { width: exportWidth, height: exportHeight });
          if (originalWidth) svgNode.setAttribute('width', originalWidth);
          if (originalHeight) svgNode.setAttribute('height', originalHeight);
          const link = document.createElement('a');
          link.download = 'edited-svg.png';
          link.href = dataUrl;
          link.click();
        }
      } catch (error) {
        console.error('Error converting to PNG:', error);
      }
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 3 }, maxWidth: 1400, margin: '0 auto', background: '#F4F4F4', minHeight: '100vh' }}>
      <Typography variant="h4" gutterBottom fontWeight={700} color="black" sx={{ mb: '20px' }}>
        Duplicator
      </Typography>
      <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
        <Paper sx={{ flex: 1, p: 3, minWidth: 0, boxShadow: '0 2px 16px 0 rgba(0,0,0,0.06)', borderRadius: 1, border: '2px solid #d1d5db', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
          <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" fontWeight={600}>
              SVG Preview
            </Typography>
            {svgContent && (
              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none', mr: 1 }}
                  onClick={() => {
                    setSvgContent(originalSvgContent);
                    extractImages(originalSvgContent);
                  }}
                >
                  Reset
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
                  onClick={() => {
                    setSvgContent('');
                    setOriginalSvgContent('');
                    setImages([]);
                  }}
                >
                  Clear
                </Button>
              </Box>
            )}
          </Box>
          <Box
            ref={svgContainerRef}
            sx={{
              border: 'none',
              borderRadius: 1,
              p: 2,
              minHeight: 600,
              width: '100%',
              background: svgContent ? '#fff' : '#f6fff8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'border 0.2s',
              position: 'relative',
              cursor: !svgContent ? 'pointer' : 'default',
              ...(svgDragActive && !svgContent ? { background: '#e6f4ea', border: '3px dashed #14532d' } : {}),
            }}
            onDrop={!svgContent ? handleSvgDrop : undefined}
            onDragOver={!svgContent ? handleSvgDragOver : undefined}
            onDragLeave={!svgContent ? handleSvgDragLeave : undefined}
          >
            {!svgContent ? (
              <Button
                variant="contained"
                component="label"
                startIcon={<CloudUploadIcon />}
                color="primary"
                sx={{ fontSize: 18, px: 4, py: 2, borderRadius: 2, boxShadow: 2 }}
              >
                Upload SVG
                <input
                  type="file"
                  hidden
                  accept=".svg"
                  onChange={handleFileUpload}
                />
              </Button>
            ) : (
              <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svgWithOutline }} />
            )}
          </Box>
        </Paper>
        <Box sx={{ width: 370, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Paper
            sx={{ width: '100%', p: 3, boxShadow: '0 2px 16px 0 rgba(0,0,0,0.06)', borderRadius: 1 }}
            onDrop={handleImageListDrop}
            onDragOver={handleImageListDragOver}
            onDragLeave={handleImageListDragLeave}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Images in SVG
              </Typography>
            </Box>
            <List>
              {images.map((image) => (
                <ListItem key={image.id} alignItems="flex-start" sx={{ mb: 2, borderRadius: 2, bgcolor: '#e6f4ea', transition: 'background 0.2s', boxShadow: imageDragActive === image.id ? 4 : 0 }}>
                  <Box
                    component="div"
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}
                    onDrop={(e) => handleImageDrop(e, image.id)}
                    onDragOver={(e) => handleImageDragOver(e, image.id)}
                    onDragLeave={(e) => handleImageDragLeave(e, image.id)}
                    style={{ background: imageDragActive === image.id ? '#d1fae5' : undefined, borderRadius: 8, padding: 2 }}
                  >
                    <Box
                      component="img"
                      src={image.href}
                      alt={image.id}
                      sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 2, border: '1px solid #d1fae5', bgcolor: '#fff' }}
                    />
                    <Button
                      size="small"
                      component="label"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    >
                      Replace
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = URL.createObjectURL(file);
                            handleImageReplace(image.id, url, file);
                          }
                        }}
                      />
                    </Button>
                  </Box>
                </ListItem>
              ))}
            </List>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', fontSize: 12 }}>
              Tip: Drag and drop one image onto a row to replace it, or drop up to 3 images anywhere on this card to replace the first three images at once.
            </Typography>
          </Paper>
          {svgContent && (
            <Paper sx={{ p: 3, width: '100%', boxShadow: '0 2px 16px 0 rgba(0,0,0,0.06)', borderRadius: 1 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
                Export PNG
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <TextField
                  label="Width"
                  type="number"
                  value={exportWidth}
                  onChange={handleWidthChange}
                  size="small"
                  sx={{ width: 120 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">px</InputAdornment>,
                  }}
                />
                <IconButton onClick={handleAspectLockToggle} color="primary" sx={{ mx: 1 }}>
                  {aspectLocked ? <LockIcon /> : <LockOpenIcon />}
                </IconButton>
                <TextField
                  label="Height"
                  type="number"
                  value={exportHeight}
                  onChange={handleHeightChange}
                  size="small"
                  sx={{ width: 120 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">px</InputAdornment>,
                  }}
                />
              </Box>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleDownload}
                color="primary"
                sx={{ fontSize: 16, px: 4, py: 1.5, borderRadius: 2, boxShadow: 2 }}
              >
                Download as PNG
              </Button>
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SVGEditor; 