import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Maximize2,
  Loader,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Download,
} from 'lucide-react';
import axios from 'axios';

// Replace 'YOUR_API_KEY' with your actual Stability AI API key
const API_KEY = 'sk-ZcSJz43ojYUkoKbsvfvRmW0X6LB2w7vvZkmXB45C448O5tmM';

const commonSizes = [
  { name: 'Custom', width: 800, height: 600 },
  { name: 'Desktop - 1920x1080', width: 1920, height: 1080 },
  { name: 'Desktop - 1366x768', width: 1366, height: 768 },
  { name: 'Desktop - 1536x864', width: 1536, height: 864 },
  { name: 'Desktop - 1280x720', width: 1280, height: 720 },
  { name: 'Desktop - 1440x900', width: 1440, height: 900 },
  { name: 'Desktop - 1600x900', width: 1600, height: 900 },
  { name: 'Mobile - 360x800', width: 360, height: 800 },
  { name: 'Mobile - 390x844', width: 390, height: 844 },
  { name: 'Mobile - 393x873', width: 393, height: 873 },
  { name: 'Mobile - 412x915', width: 412, height: 915 },
  { name: 'Mobile - 414x896', width: 414, height: 896 },
  { name: 'Mobile - 360x780', width: 360, height: 780 },
];

type Direction = 'left' | 'right' | 'up' | 'down';

function App() {
  const [image, setImage] = useState<File | null>(null);
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [outpaintedImage, setOutpaintedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [directions, setDirections] = useState<Direction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSize, setSelectedSize] = useState(commonSizes[0]);

  const handleDownload = () => {
    if (outpaintedImage) {
      const link = document.createElement('a');
      link.href = outpaintedImage;
      link.download = 'outpainted_image.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  useEffect(() => {
    if (image) {
      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height });
      };
      img.src = URL.createObjectURL(image);
    }
  }, [image]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImage(file);
      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => setOutpaintedImage(e.target?.result as string);
      reader.onerror = () =>
        setError('Failed to read the image file. Please try again.');
      reader.readAsDataURL(file);
    }
  };

  const handleSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = commonSizes[parseInt(event.target.value)];
    setSelectedSize(selected);
    setWidth(selected.width);
    setHeight(selected.height);
  };

  const toggleDirection = (dir: Direction) => {
    setDirections((prev) =>
      prev.includes(dir) ? prev.filter((d) => d !== dir) : [...prev, dir]
    );
  };

  const resizeImage = (
    file: File,
    targetWidth: number,
    targetHeight: number
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        let newWidth = img.width;
        let newHeight = img.height;

        if (img.width > targetWidth || img.height > targetHeight) {
          const aspectRatio = img.width / img.height;
          if (aspectRatio > targetWidth / targetHeight) {
            newWidth = targetWidth;
            newHeight = newWidth / aspectRatio;
          } else {
            newHeight = targetHeight;
            newWidth = newHeight * aspectRatio;
          }
        }

        canvas.width = newWidth;
        canvas.height = newHeight;

        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        }, 'image/png');
      };
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleOutpaint = async () => {
    if (!image || !imageSize) {
      setError('Please upload an image before outpainting.');
      return;
    }

    if (directions.length === 0) {
      setError('Please select at least one direction for outpainting.');
      return;
    }

    setLoading(true);
    setError(null);
    setOutpaintedImage(null);

    try {
      // Resize the image
      const resizedImage = await resizeImage(image, width, height);

      // Calculate the differences between desired size and resized image size
      const resizedImg = new Image();
      await new Promise((resolve) => {
        resizedImg.onload = resolve;
        resizedImg.src = URL.createObjectURL(resizedImage);
      });
      const widthDiff = width - resizedImg.width;
      const heightDiff = height - resizedImg.height;

      const payload: Record<string, any> = {
        image: resizedImage,
        output_format: 'png',
      };

      // Set outpainting values based on the selected directions
      if (directions.includes('left')) {
        payload.left = Math.max(0, Math.floor(widthDiff / 2));
      }
      if (directions.includes('right')) {
        payload.right = Math.max(0, Math.ceil(widthDiff / 2));
      }
      if (directions.includes('up')) {
        payload.up = Math.max(0, Math.floor(heightDiff / 2));
      }
      if (directions.includes('down')) {
        payload.down = Math.max(0, Math.ceil(heightDiff / 2));
      }

      // Adjust values if only one horizontal or vertical direction is selected
      if (directions.includes('left') && !directions.includes('right')) {
        payload.left = Math.max(0, widthDiff);
      } else if (directions.includes('right') && !directions.includes('left')) {
        payload.right = Math.max(0, widthDiff);
      }
      if (directions.includes('up') && !directions.includes('down')) {
        payload.up = Math.max(0, heightDiff);
      } else if (directions.includes('down') && !directions.includes('up')) {
        payload.down = Math.max(0, heightDiff);
      }

      const hasValidDirection = Object.entries(payload).some(
        ([key, value]) =>
          ['left', 'right', 'up', 'down'].includes(key) && value > 0
      );

      if (!hasValidDirection) {
        setError(
          'Please select a size larger than the original image for outpainting.'
        );
        setLoading(false);
        return;
      }

      if (prompt) {
        payload.prompt = prompt;
      }

      payload.cfg_scale = 0.5;

      const response = await axios.postForm(
        'https://api.stability.ai/v2beta/stable-image/edit/outpaint',
        payload,
        {
          validateStatus: undefined,
          responseType: 'arraybuffer',
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            Accept: 'image/*',
          },
        }
      );

      if (response.status === 200) {
        const blob = new Blob([response.data], { type: 'image/png' });
        const imageUrl = URL.createObjectURL(blob);
        setOutpaintedImage(imageUrl);
      } else {
        const errorMessage = new TextDecoder().decode(response.data);
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorMessage}`
        );
      }
    } catch (error) {
      console.error('Error:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          const errorMessage = new TextDecoder().decode(error.response.data);
          setError(`API Error: ${error.response.status} - ${errorMessage}`);
        } else if (error.request) {
          setError(
            'No response received from the server. Please check your internet connection and try again.'
          );
        } else {
          setError(`Error setting up the request: ${error.message}`);
        }
      } else {
        setError(`An unexpected error occurred: ${(error as Error).message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-animated flex flex-col items-center justify-center p-8">
      <div className="bg-white bg-opacity-90 rounded-lg shadow-lg p-8 w-full max-w-2xl">
        <img
          src="/src/assets/logo-placeholder.svg"
          alt="WallWizard Logo"
          className="mb-8 w-64 h-auto mx-auto"
        />
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Image
          </label>
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition duration-300">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-10 h-10 mb-3 text-primary" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag
                  and drop
                </p>
                <p className="text-xs text-gray-500">
                  PNG, JPG or GIF (Max. 10mb)
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                onChange={handleImageUpload}
                accept="image/*"
                ref={fileInputRef}
              />
            </label>
          </div>
        </div>
        {outpaintedImage && (
          <div className="mb-6">
            <img
              src={outpaintedImage}
              alt="Outpainted"
              className="w-full h-auto rounded-lg shadow-md"
            />
          </div>
        )}
        <div className="mb-6">
          <label
            htmlFor="direction"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Magic Directions
          </label>
          <div className="flex justify-between">
            {(['left', 'right', 'up', 'down'] as Direction[]).map((dir) => (
              <button
                key={dir}
                onClick={() => toggleDirection(dir)}
                className={`p-2 rounded-md ${
                  directions.includes(dir)
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {dir === 'left' && <ArrowLeft />}
                {dir === 'right' && <ArrowRight />}
                {dir === 'up' && <ArrowUp />}
                {dir === 'down' && <ArrowDown />}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-6">
          <label
            htmlFor="size"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Output Size
          </label>
          <select
            id="size"
            value={commonSizes.findIndex(
              (size) => size.width === width && size.height === height
            )}
            onChange={handleSizeChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {commonSizes.map((size, index) => (
              <option key={size.name} value={index}>
                {size.name} ({size.width}x{size.height})
              </option>
            ))}
          </select>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="width"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Width
            </label>
            <input
              type="number"
              id="width"
              value={width}
              onChange={(e) => setWidth(Math.max(1, parseInt(e.target.value)))}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor="height"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Height
            </label>
            <input
              type="number"
              id="height"
              value={height}
              onChange={(e) => setHeight(Math.max(1, parseInt(e.target.value)))}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="mb-6">
          <label
            htmlFor="prompt"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Prompt
          </label>
          <input
            type="text"
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe how to continue the image"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {error && (
          <div
            className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded relative"
            role="alert"
          >
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        <button
          onClick={handleOutpaint}
          disabled={loading || !image || directions.length === 0}
          className="bg-primary hover:bg-secondary text-white font-semibold py-2 px-4 rounded-md w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition duration-300 ease-in-out"
        >
          {loading ? (
            <>
              <Loader className="w-5 h-5 mr-2 animate-spin" />
              Outpainting...
            </>
          ) : (
            <>
              <Maximize2 className="w-5 h-5 mr-2" />
              Outpaint Image
            </>
          )}
        </button>
        {outpaintedImage && !loading && (
          <div className="mt-6">
            <button
              onClick={handleDownload}
              className="bg-secondary hover:bg-primary text-white font-semibold py-2 px-4 rounded-md w-full flex items-center justify-center transition duration-300 ease-in-out"
            >
              <Download className="w-5 h-5 mr-2" />
              Download Image
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
