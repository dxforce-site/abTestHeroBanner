/**
 * @description       : A/Bテスト機能付きヒーローバナー コントローラー
 * ビルダーでのプレビュー機能を追加
 * @author            : Eiji Fukushima
 * @group             : DXforce
 * @last modified on  : 2025-12-29
 */
import { LightningElement, api } from 'lwc';
import basePath from '@salesforce/community/basePath';
import logAction from '@salesforce/apex/AbTestLogger.logAction';

const STORAGE_KEY_ASSIGNMENT = 'AB_TEST_ASSIGNMENT_';
const STORAGE_KEY_LOGGED = 'AB_LOGGED_';
const STORAGE_KEY_VISITOR = 'DXFORCE_VISITOR_ID';

export default class AbTestHeroBanner extends LightningElement {
    // ----------------------------------------------------------------
    // 公開プロパティ
    // ----------------------------------------------------------------

    @api testId;
    @api imageHeight; 

    /** * ビルダー用プレビュー設定 
     * セッターを使用して、変更時に即座に再描画をトリガーします
     */
    _previewMode = 'Auto';
    @api
    get previewMode() {
        return this._previewMode;
    }
    set previewMode(value) {
        this._previewMode = value;
        this.initializeAssignment(); // 設定変更時に再計算
    }

    /** パターンA設定 */
    @api variantA_ImageContent; 
    @api variantA_ImagePosition;
    @api variantA_Title;
    @api variantA_Description;
    @api variantA_ButtonLabel;
    @api variantA_ButtonUrl;

    /** パターンB設定 */
    @api variantB_ImageContent; 
    @api variantB_ImagePosition;
    @api variantB_Title;
    @api variantB_Description;
    @api variantB_ButtonLabel;
    @api variantB_ButtonUrl;

    // ----------------------------------------------------------------
    // 内部状態
    // ----------------------------------------------------------------

    assignedVariant; 
    visitorId;

    // ----------------------------------------------------------------
    // ライフサイクルメソッド
    // ----------------------------------------------------------------

    connectedCallback() {
        this.initializeVisitorId();
        this.initializeAssignment();
    }

    renderedCallback() {
        // プレビューモードが 'Auto' (本番動作) の場合のみログを送る
        if (this.assignedVariant && this.testId && this.previewMode === 'Auto') {
            this.tryLogMetric('View');
        }
    }

    // ----------------------------------------------------------------
    // イベントハンドラ
    // ----------------------------------------------------------------

    handleButtonClick() {
        // プレビューモードが 'Auto' の場合のみログを送る
        if (this.assignedVariant && this.testId && this.previewMode === 'Auto') {
            this.tryLogMetric('Click');
        }
    }

    // ----------------------------------------------------------------
    // ロジック (初期化・判定)
    // ----------------------------------------------------------------

    initializeVisitorId() {
        let vid = localStorage.getItem(STORAGE_KEY_VISITOR);
        if (!vid) {
            vid = this.generateUUID();
            localStorage.setItem(STORAGE_KEY_VISITOR, vid);
        }
        this.visitorId = vid;
    }

    /**
     * A/Bパターンの割り当てロジック
     * プレビューモードの設定を最優先する
     */
    initializeAssignment() {
        // 1. ビルダーでの強制指定があればそれを優先
        if (this.previewMode === 'Force A') {
            this.assignedVariant = 'A';
            return;
        }
        if (this.previewMode === 'Force B') {
            this.assignedVariant = 'B';
            return;
        }

        // 2. 通常のランダム/維持ロジック (Auto)
        if (!this.testId) {
            this.assignedVariant = 'A';
            return;
        }

        const key = STORAGE_KEY_ASSIGNMENT + this.testId;
        const storedAssignment = localStorage.getItem(key);

        if (storedAssignment) {
            this.assignedVariant = storedAssignment;
        } else {
            this.assignedVariant = Math.random() < 0.5 ? 'A' : 'B';
            localStorage.setItem(key, this.assignedVariant);
        }
    }

    // ----------------------------------------------------------------
    // ログ送信・補助メソッド (変更なし)
    // ----------------------------------------------------------------

    tryLogMetric(actionType) {
        const logKey = `${STORAGE_KEY_LOGGED}${this.testId}_${actionType}`;
        const hasLogged = localStorage.getItem(logKey);

        if (!hasLogged) {
            logAction({
                testId: this.testId,
                variant: this.assignedVariant,
                actionType: actionType,
                visitorId: this.visitorId
            }).catch(error => {
                console.error('[AB Test] Logging failed', error);
            });
            localStorage.setItem(logKey, 'true');
        }
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    extractContentKey(contentRef) {
        if (!contentRef) return null;
        try {
            const ref = typeof contentRef === 'string' ? JSON.parse(contentRef) : contentRef;
            return ref.contentKey || ref.id || null;
        } catch (e) {
            return typeof contentRef === 'string' ? contentRef : null;
        }
    }

    constructCmsUrl(contentKey) {
        if (!contentKey) return null;
        const sitePrefix = (basePath && basePath !== '') ? basePath : '';
        return `${sitePrefix}/sfsites/c/cms/delivery/media/${contentKey}`;
    }

    resolveUrl(url) {
        if (!url) return '#';
        if (url.match(/^(http|https|mailto|tel):/)) {
            return url;
        }
        const path = url.startsWith('/') ? url : '/' + url;
        return (basePath || '') + path;
    }

    get contentKeyA() { return this.extractContentKey(this.variantA_ImageContent); }
    get contentKeyB() { return this.extractContentKey(this.variantB_ImageContent); }

    get currentData() {
        const isA = (this.assignedVariant === 'A');
        
        const key = isA ? this.contentKeyA : this.contentKeyB;
        const title = isA ? this.variantA_Title : this.variantB_Title;
        const desc = isA ? this.variantA_Description : this.variantB_Description;
        const btnLabel = isA ? this.variantA_ButtonLabel : this.variantB_ButtonLabel;
        const btnUrl = isA ? this.variantA_ButtonUrl : this.variantB_ButtonUrl;
        
        const position = isA ? (this.variantA_ImagePosition || 'center') : (this.variantB_ImagePosition || 'center');
        const height = this.imageHeight || 400;

        return {
            imageUrl: this.constructCmsUrl(key),
            altText: title,
            title: title,
            description: desc,
            buttonLabel: btnLabel,
            buttonUrl: this.resolveUrl(btnUrl),
            imageStyle: `width: 100%; height: ${height}px; object-fit: cover; object-position: ${position}; border-radius: 4px;`
        };
    }
}