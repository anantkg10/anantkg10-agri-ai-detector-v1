import React, { useState, useMemo, useEffect } from 'react';
import Icon from '../components/Icon';
import { Article } from '../types';
import HolographicButton from '../components/HolographicButton';
import { useLocalization } from '../contexts/LocalizationContext';

export const getArticles = (t: (key: string) => string): Article[] => [
    { 
        id: 1, title: t('kh_article_1_title'), category: t('kh_cat_fungal'), icon: 'leaf', image: 'https://picsum.photos/seed/mildew/400/200',
        summary: t('kh_article_1_summary'),
        content: (
            <div className="space-y-4 text-gray-300">
                <p>{t('kh_article_1_content_p1')}</p>
                <h4 className="text-lg font-bold text-green-300">{t('kh_causes_title')}</h4>
                <ul className="list-disc pl-6 space-y-1">
                    <li>{t('kh_article_1_content_causes_li1')}</li>
                    <li>{t('kh_article_1_content_causes_li2')}</li>
                    <li>{t('kh_article_1_content_causes_li3')}</li>
                </ul>
                <h4 className="text-lg font-bold text-green-300">{t('kh_management_title')}</h4>
                <ul className="list-disc pl-6 space-y-1">
                    <li>{t('kh_article_1_content_management_li1')}</li>
                    <li>{t('kh_article_1_content_management_li2')}</li>
                    <li>{t('kh_article_1_content_management_li3')}</li>
                </ul>
            </div>
        )
    },
    { 
        id: 2, title: t('kh_article_2_title'), category: t('kh_cat_techniques'), icon: 'rotate', image: 'https://picsum.photos/seed/rotation/400/200',
        summary: t('kh_article_2_summary'),
        content: (
            <div className="space-y-4 text-gray-300">
                <p>{t('kh_article_2_content_p1')}</p>
                <h4 className="text-lg font-bold text-green-300">{t('kh_principles_title')}</h4>
                <ul className="list-disc pl-6 space-y-1">
                    <li><strong>{t('kh_article_2_content_principles_li1_strong')}</strong> {t('kh_article_2_content_principles_li1_text')}</li>
                    <li><strong>{t('kh_article_2_content_principles_li2_strong')}</strong> {t('kh_article_2_content_principles_li2_text')}</li>
                    <li><strong>{t('kh_article_2_content_principles_li3_strong')}</strong> {t('kh_article_2_content_principles_li3_text')}</li>
                </ul>
            </div>
        )
    },
    { 
        id: 3, title: t('kh_article_3_title'), category: t('kh_cat_pest'), icon: 'warning', image: 'https://picsum.photos/seed/aphids/400/200',
        summary: t('kh_article_3_summary'),
        content: (
            <div className="space-y-4 text-gray-300">
                <p>{t('kh_article_3_content_p1')}</p>
                <h4 className="text-lg font-bold text-green-300">{t('kh_control_methods_title')}</h4>
                 <ul className="list-disc pl-6 space-y-1">
                    <li><strong>{t('kh_article_3_content_methods_li1_strong')}</strong> {t('kh_article_3_content_methods_li1_text')}</li>
                    <li><strong>{t('kh_article_3_content_methods_li2_strong')}</strong> {t('kh_article_3_content_methods_li2_text')}</li>
                    <li><strong>{t('kh_article_3_content_methods_li3_strong')}</strong> {t('kh_article_3_content_methods_li3_text')}</li>
                </ul>
            </div>
        )
    },
    { 
        id: 4, title: t('kh_article_4_title'), category: t('kh_cat_soil'), icon: 'shield', image: 'https://picsum.photos/seed/soil/400/200',
        summary: t('kh_article_4_summary'),
        content: (
            <div className="space-y-4 text-gray-300">
                <p>{t('kh_article_4_content_p1')}</p>
                <h4 className="text-lg font-bold text-green-300">{t('kh_improving_soil_title')}</h4>
                 <ul className="list-disc pl-6 space-y-1">
                    <li><strong>{t('kh_article_4_content_improving_li1_strong')}</strong> {t('kh_article_4_content_improving_li1_text')}</li>
                    <li><strong>{t('kh_article_4_content_improving_li2_strong')}</strong> {t('kh_article_4_content_improving_li2_text')}</li>
                    <li><strong>{t('kh_article_4_content_improving_li3_strong')}</strong> {t('kh_article_4_content_improving_li3_text')}</li>
                </ul>
            </div>
        )
    },
];

const ArticleDetailView: React.FC<{ article: Article; onBack: () => void }> = ({ article, onBack }) => {
    const { t } = useLocalization();
    return (
        <div className="container mx-auto p-4">
            <HolographicButton onClick={onBack} className="mb-8 py-2 px-4 text-sm">
                &larr; {t('backToHub')}
            </HolographicButton>
            <div className="bg-black/30 backdrop-blur-md rounded-xl holographic-border overflow-hidden">
                <img src={article.image} alt={article.title} className="w-full h-64 object-cover" />
                <div className="p-8">
                    <p className="text-sm text-green-400 mb-2">{article.category}</p>
                    <h2 className="text-4xl font-bold text-white mb-6">{article.title}</h2>
                    {article.content}
                </div>
            </div>
        </div>
    );
};

interface KnowledgeHubViewProps {
  navigationState: any;
  clearNavigationState: () => void;
}

const KnowledgeHubView: React.FC<KnowledgeHubViewProps> = ({ navigationState, clearNavigationState }) => {
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { t } = useLocalization();
    const articles = useMemo(() => getArticles(t), [t]);

    useEffect(() => {
        if (navigationState?.selectedArticleId) {
            const article = articles.find(a => a.id === navigationState.selectedArticleId);
            if (article) {
                setSelectedArticle(article);
            }
            clearNavigationState();
        }
    }, [navigationState, clearNavigationState, articles]);


    const filteredArticles = useMemo(() => 
        articles.filter(article => 
            article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            article.category.toLowerCase().includes(searchTerm.toLowerCase())
        ),
    [searchTerm, articles]);

    if (selectedArticle) {
        return <ArticleDetailView article={selectedArticle} onBack={() => setSelectedArticle(null)} />;
    }

    return (
        <div className="container mx-auto p-4">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-green-300">{t('knowledgeHub')}</h2>
                <p className="text-gray-400 max-w-2xl mx-auto mt-4">
                    {t('knowledgeHubSubtitle')}
                </p>
                 <div className="mt-6 max-w-lg mx-auto">
                    <input
                        type="text"
                        placeholder={t('searchArticlesPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black/30 holographic-border rounded-full px-6 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredArticles.map((article) => (
                    <div 
                        key={article.id} 
                        className="bg-black/30 backdrop-blur-md rounded-xl holographic-border overflow-hidden group transform hover:-translate-y-2 transition-transform duration-300 cursor-pointer"
                        onClick={() => setSelectedArticle(article)}
                    >
                        <img src={article.image} alt={article.title} className="w-full h-40 object-cover group-hover:opacity-80 transition-opacity" />
                        <div className="p-6">
                            <p className="text-sm text-green-400 mb-1">{article.category}</p>
                            <h3 className="text-xl font-bold text-white mb-2">{article.title}</h3>
                            <p className="text-gray-400 text-sm mb-4">{article.summary}</p>
                            <div className="flex items-center space-x-2 text-green-300 font-semibold group-hover:text-white transition-colors">
                                <span>{t('readMore')}</span>
                                <Icon name="arrowRight" className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {filteredArticles.length === 0 && (
                <div className="text-center py-10">
                    <p className="text-lg text-gray-400">{t('noArticlesFound')}</p>
                </div>
            )}
        </div>
    );
};

export default KnowledgeHubView;
