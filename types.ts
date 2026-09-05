// Remove Vite client types as they are no longer needed.

// Fix: Import React to resolve namespace issue for React.ReactNode.
import React from 'react';

export enum View {
  DASHBOARD = 'DASHBOARD',
  SCAN = 'SCAN',
  HISTORY = 'HISTORY',
  COMMUNITY = 'COMMUNITY',
  KNOWLEDGE_HUB = 'KNOWLEDGE_HUB',
}

export enum Severity {
    MILD = 'Mild',
    MODERATE = 'Moderate',
    SEVERE = 'Severe',
    HEALTHY = 'Healthy'
}

export interface Treatment {
    name: string;
    description: string;
}

export interface PreventionTip {
    name: string;
    description: string;
}

export interface ScanResult {
    diseaseName: string;
    confidence: number;
    severity: Severity;
    treatments: Treatment[];
    preventionTips: PreventionTip[];
    summary: string;
}

export interface HistoryItem extends ScanResult {
    id: string;
    date: string;
    imagePreview: string;
}

export interface Article {
    id: number;
    title: string;
    category: string;
    icon: 'leaf' | 'rotate' | 'warning' | 'shield' | 'water' | 'fertilizer';
    image: string;
    // Fix: Add missing summary property to the Article interface.
    summary: string;
    content: React.ReactNode;
}

export interface Reply {
    id: string;
    author: string;
    avatar: string;
    time: string;
    content: string;
}

export interface Post {
    id: string;
    author: string;
    avatar: string;
    time: string;
    title: string;
    content: string;
    replies: Reply[];
    views: number;
}


export interface TranscriptMessage {
  role: 'user' | 'model';
  text: string;
}