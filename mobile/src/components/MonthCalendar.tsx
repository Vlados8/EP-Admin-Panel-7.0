import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

interface Props {
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  notes?: any[];
}

export function MonthCalendar({ selectedDate, onSelectDate, notes = [] }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const initialDate = selectedDate || new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Monday is 0

  const prevMonthDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Group notes by local YYYY-MM-DD
  const notesByDate = (notes || []).reduce((acc: Record<string, any[]>, note: any) => {
    const noteDateStr = note.date ? note.date.split('T')[0] : '';
    if (noteDateStr) {
      if (!acc[noteDateStr]) acc[noteDateStr] = [];
      acc[noteDateStr].push(note);
    }
    return acc;
  }, {});

  const getDotColor = (color: string) => {
    if (!color) return '#3B82F6';
    if (color.startsWith('#')) return color;
    switch (color.toLowerCase()) {
      case 'red': return '#EF4444';
      case 'green': return '#10B981';
      case 'yellow': return '#F59E0B';
      case 'purple': return '#8B5CF6';
      case 'blue': return '#3B82F6';
      default: return '#3B82F6';
    }
  };

  const renderCells = () => {
    const cells = [];
    const totalCells = (startOffset + daysInMonth) > 35 ? 42 : 35;
    
    for (let i = 0; i < totalCells; i++) {
      let dayNumber, isCurrentMonth, cellDateValue, monthOffset;
      if (i < startOffset) {
        dayNumber = prevMonthDays - startOffset + i + 1;
        isCurrentMonth = false;
        cellDateValue = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, dayNumber);
        monthOffset = -1;
      } else if (i >= startOffset + daysInMonth) {
        dayNumber = i - startOffset - daysInMonth + 1;
        isCurrentMonth = false;
        cellDateValue = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, dayNumber);
        monthOffset = 1;
      } else {
        dayNumber = i - startOffset + 1;
        isCurrentMonth = true;
        cellDateValue = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNumber);
        monthOffset = 0;
      }

      const localISO = new Date(cellDateValue.getTime() - cellDateValue.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      const isSelected = selectedDate ? selectedDate.toDateString() === cellDateValue.toDateString() : false;
      const isToday = new Date().toDateString() === cellDateValue.toDateString();
      const dayNotes = notesByDate[localISO] || [];

      cells.push(
        <TouchableOpacity 
          key={i} 
          onPress={() => {
            onSelectDate(cellDateValue);
            if (!isCurrentMonth) {
              setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + monthOffset, 1));
            }
          }}
          activeOpacity={0.8}
          className={`w-10 h-10 items-center justify-center rounded-xl mx-1 my-1 relative ${
            isSelected 
              ? 'bg-[#3B82F6] border border-[#3B82F6] shadow-lg shadow-blue-500/50' 
              : isToday 
                ? 'border border-[#3B82F6]/50 bg-[#3B82F6]/10' 
                : 'hover:bg-white/5'
          } ${!isCurrentMonth ? 'opacity-30' : ''}`}
        >
          <Text className={`font-bold text-[11px] ${
             isSelected 
               ? 'text-white font-black' 
               : isToday 
                 ? 'text-[#3B82F6] font-black' 
                 : isCurrentMonth ? 'text-gray-300' : 'text-gray-600'
          }`}>{dayNumber}</Text>
          
          {dayNotes.length > 0 && (
            <View className="absolute bottom-1.5 flex-row justify-center items-center gap-x-[2px] w-full px-1">
              {dayNotes.slice(0, 4).map((note: any, idx: number) => (
                <View 
                  key={note.id || idx} 
                  style={{ backgroundColor: getDotColor(note.color) }}
                  className="w-[4px] h-[4px] rounded-full shrink-0" 
                />
              ))}
            </View>
          )}
        </TouchableOpacity>
      );
    }
    return cells;
  };

  return (
    <View className="bg-[#1A1A1A] p-5 rounded-[28px] border border-white/5 mb-6 shadow-2xl shadow-black">
      {/* Title & Clear Filter top bar */}
      {selectedDate && (
        <View className="flex-row justify-between items-center pb-3 border-b border-white/5 mb-4 px-1">
          <Text className="text-sm font-semibold text-white">Kalender-Filter</Text>
          <TouchableOpacity onPress={() => onSelectDate(null)}>
            <Text className="text-xs text-blue-400 font-semibold">Filter löschen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Calendar Header with Navigation */}
      <View className="flex-row justify-between items-center mb-5 px-1">
        <TouchableOpacity onPress={handlePrevMonth} className="w-8 h-8 items-center justify-center bg-white/5 rounded-lg border border-white/5">
          <ChevronLeft size={16} color="#9CA3AF" />
        </TouchableOpacity>
        
        <View className="flex-row items-center gap-x-3">
          <TouchableOpacity 
            onPress={() => {
              const today = new Date();
              setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              onSelectDate(today);
            }}
            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5"
          >
            <Text className="text-blue-400 text-[10px] font-black uppercase tracking-wider">Heute</Text>
          </TouchableOpacity>
          <Text className="text-xs font-black text-white uppercase tracking-wider">
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
        </View>

        <TouchableOpacity onPress={handleNextMonth} className="w-8 h-8 items-center justify-center bg-white/5 rounded-lg border border-white/5">
          <ChevronRight size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
      
      {/* Week Headers */}
      <View className="flex-row justify-between mb-3 border-b border-white/5 pb-2">
        {DAYS.map(d => (
          <View key={d} className="w-10 items-center">
            <Text className="text-gray-500 text-[10px] font-black uppercase">{d}</Text>
          </View>
        ))}
      </View>

      {/* Day Cells Grid */}
      <View className="flex-row flex-wrap justify-between">
        {renderCells()}
      </View>
    </View>
  );
}
