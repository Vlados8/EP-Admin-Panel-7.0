import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  markedDates?: string[];
}

export function MonthCalendar({ selectedDate, onSelectDate, markedDates = [] }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

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

  const renderCells = () => {
    const cells = [];
    const totalCells = 42; 
    
    for (let i = 0; i < totalCells; i++) {
      let dayNumber, isCurrentMonth, cellDateValue;
      if (i < startOffset) {
        dayNumber = prevMonthDays - startOffset + i + 1;
        isCurrentMonth = false;
        cellDateValue = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, dayNumber);
      } else if (i >= startOffset + daysInMonth) {
        dayNumber = i - startOffset - daysInMonth + 1;
        isCurrentMonth = false;
        cellDateValue = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, dayNumber);
      } else {
        dayNumber = i - startOffset + 1;
        isCurrentMonth = true;
        cellDateValue = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNumber);
      }

      // Convert local date to YYYY-MM-DD for comparison and markedDates check
      const localISO = new Date(cellDateValue.getTime() - cellDateValue.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      const isSelected = selectedDate.toDateString() === cellDateValue.toDateString();
      const hasNote = markedDates.includes(localISO);

      cells.push(
        <TouchableOpacity 
          key={i} 
          disabled={!isCurrentMonth}
          onPress={() => isCurrentMonth && onSelectDate(cellDateValue)}
          className={`w-10 h-10 items-center justify-center rounded-xl mx-1 my-1 relative ${
            isSelected ? 'bg-brand-blue shadow-lg shadow-blue-500/50' : ''
          }`}
        >
          <Text className={`font-bold text-sm ${
             isCurrentMonth 
                ? (isSelected ? 'text-white' : 'text-gray-300')
                : 'text-gray-700'
          }`}>{dayNumber}</Text>
          {hasNote && isCurrentMonth && (
            <View className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#FF6B6B]' : 'bg-[#FF6B6B]'}`} />
          )}
        </TouchableOpacity>
      );
    }
    return cells;
  };

  return (
    <View className="bg-[#1A1A1A] p-4 rounded-[28px] border border-white/5 mb-6 shadow-2xl shadow-black">
      <View className="flex-row justify-between items-center mb-6 px-4">
        <TouchableOpacity onPress={handlePrevMonth} className="p-2">
          <ChevronLeft size={20} color="#6B7280" />
        </TouchableOpacity>
        <Text className="text-white font-black text-lg">
          {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Text>
        <TouchableOpacity onPress={handleNextMonth} className="p-2">
          <ChevronRight size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>
      
      <View className="flex-row justify-between mb-2">
        {DAYS.map(d => (
          <View key={d} className="w-10 mx-1 items-center">
            <Text className="text-gray-500 text-[11px] font-bold uppercase">{d}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap justify-between">
        {renderCells()}
      </View>
    </View>
  );
}
