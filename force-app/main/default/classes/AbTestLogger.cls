/**
 * @description       : A/Bテストの実績ログを管理するコントローラー
 * ゲストユーザーによる書き込みを許可するため without sharing を適用
 * @author            : Eiji Fukushima
 * @group             : DXforce
 * @last modified on  : 2025-12-29
 */
public without sharing class AbTestLogger {

    /**
     * @description A/Bテストの表示またはクリックイベントを記録します。
     * Unique_Key__c を使用して Upsert を行い、同一ビジターによる重複カウントを防止します。
     * @param testId     テストを識別するID
     * @param variant    表示されたバリエーション ('A' または 'B')
     * @param actionType アクションの種類 ('View' または 'Click')
     * @param visitorId  ブラウザ固有のビジターID
     */
    @AuraEnabled
    public static void logAction(String testId, String variant, String actionType, String visitorId) {
        // 必須パラメータのチェック
        if (String.isBlank(testId) || String.isBlank(variant) || String.isBlank(visitorId)) {
            return;
        }

        try {
            AB_Test_Log__c log = new AB_Test_Log__c();
            
            // 基本情報のセット
            log.Test_Id__c = testId;
            log.Variant__c = variant;
            log.Action_Type__c = actionType;
            log.Visitor_Id__c = visitorId;
            
            // ユーザー種別の判定
            // UserInfo.getUserType() はゲストの場合 'Guest' を返します
            log.User_Type__c = (UserInfo.getUserType() == 'Guest') ? 'Guest' : 'Auth';

            // 重複排除キーの生成 (TestID + Action + VisitorID)
            log.Unique_Key__c = testId + '_' + actionType + '_' + visitorId;

            // ユニークキーに基づいてUpsert実行
            upsert log Unique_Key__c;
            
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'AB Test Logging Failed: ' + e.getMessage());
        }
    }
}