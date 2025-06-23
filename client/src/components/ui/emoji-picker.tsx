import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  trigger?: React.ReactNode;
}

const emojiCategories = {
  flags: {
    name: "Flags",
    emojis: [
      "🇺🇸", "🇨🇦", "🇲🇽", "🇧🇷", "🇦🇷", "🇬🇧", "🇫🇷", "🇩🇪", 
      "🇮🇹", "🇪🇸", "🇳🇱", "🇧🇪", "🇨🇭", "🇦🇹", "🇵🇱", "🇨🇿", 
      "🇭🇺", "🇷🇴", "🇧🇬", "🇬🇷", "🇹🇷", "🇷🇺", "🇺🇦", "🇯🇵", 
      "🇰🇷", "🇨🇳", "🇮🇳", "🇦🇺", "🇳🇿", "🇿🇦", "🇳🇬", "🇪🇬", 
      "🇮🇱", "🇸🇦", "🇦🇪", "🇮🇷", "🇮🇶", "🇯🇴", "🇱🇧", "🇸🇾"
    ]
  },
  symbols: {
    name: "Symbols",
    emojis: [
      "🔥", "⭐", "💎", "🎯", "🚀", "⚡", "💪", "🎉",
      "💯", "✨", "🌟", "💫", "⚪", "🔴", "🔵", "🟢",
      "🟡", "🟠", "🟣", "⚫", "🔸", "🔹", "💠", "🔶",
      "🔷", "💥", "💢", "💊", "🎪", "🎭", "🎨", "🎬"
    ]
  },
  numbers: {
    name: "Numbers",
    emojis: [
      "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟",
      "0️⃣", "#️⃣", "*️⃣", "⏏️", "▶️", "⏸️", "⏹️", "⏺️", "⏭️", "⏮️",
      "⏯️", "🔀", "🔁", "🔂", "◀️", "🔼", "🔽", "➡️", "⬅️", "⬆️",
      "⬇️", "↗️", "↘️", "↙️", "↖️", "↕️", "↔️", "↪️", "↩️", "⤴️"
    ]
  },
  objects: {
    name: "Objects",
    emojis: [
      "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "📟", "☎️",
      "📞", "📠", "📺", "📻", "🎵", "🎶", "🎤", "🎧",
      "📢", "📣", "📯", "🔔", "🔕", "⏰", "⏲️", "⏱️", 
      "⏳", "⌛", "📡", "🔋", "🔌", "💡", "🔦", "🔭"
    ]
  },
  faces: {
    name: "Faces",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
      "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩",
      "😘", "😗", "☺️", "😚", "😙", "🥲", "😋", "😛",
      "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔"
    ]
  }
};

export function EmojiPicker({ onEmojiSelect, trigger }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            😊 Pick Emoji
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Tabs defaultValue="flags" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="flags" className="text-xs">🏳️</TabsTrigger>
            <TabsTrigger value="symbols" className="text-xs">⭐</TabsTrigger>
            <TabsTrigger value="numbers" className="text-xs">#️⃣</TabsTrigger>
            <TabsTrigger value="objects" className="text-xs">📱</TabsTrigger>
            <TabsTrigger value="faces" className="text-xs">😊</TabsTrigger>
          </TabsList>
          
          {Object.entries(emojiCategories).map(([key, category]) => (
            <TabsContent key={key} value={key} className="mt-0">
              <div className="p-3">
                <h4 className="text-sm font-medium mb-2">{category.name}</h4>
                <ScrollArea className="h-48">
                  <div className="grid grid-cols-8 gap-1">
                    {category.emojis.map((emoji, index) => (
                      <Button
                        key={`${key}-${emoji}-${index}`}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-accent"
                        onClick={() => handleEmojiClick(emoji)}
                      >
                        <span className="text-base" style={{ fontFamily: 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' }}>
                          {emoji}
                        </span>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}