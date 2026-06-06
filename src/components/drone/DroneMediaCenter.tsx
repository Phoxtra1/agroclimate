import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Image as ImageIcon, Video, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DroneMediaCenter() {
  const mediaItems = [
    { id: 1, type: 'image', date: '2023-10-24 14:30', name: 'IMG_4921_NDVI.tif' },
    { id: 2, type: 'video', date: '2023-10-24 14:15', name: 'VID_SURVEY_01.mp4' },
    { id: 3, type: 'image', date: '2023-10-23 09:45', name: 'IMG_4920_RGB.jpg' },
    { id: 4, type: 'image', date: '2023-10-23 09:40', name: 'IMG_4919_THERMAL.tif' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {mediaItems.map(item => (
        <Card key={item.id} className="bg-slate-900 border-slate-800 text-slate-100 overflow-hidden group">
          <div className="h-32 bg-slate-950 flex items-center justify-center relative">
            {item.type === 'image' ? <ImageIcon className="h-8 w-8 text-slate-700" /> : <Video className="h-8 w-8 text-slate-700" />}
            <div className="absolute inset-0 bg-cyan-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button size="icon" variant="ghost" className="text-white hover:bg-cyan-600">
                <Download className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <CardContent className="p-3">
            <p className="text-xs font-mono text-cyan-400 truncate" title={item.name}>{item.name}</p>
            <p className="text-[10px] font-mono text-slate-500 mt-1">{item.date}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
