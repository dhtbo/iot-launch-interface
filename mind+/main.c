/*!
    * MindPlus
    * DFRobot, 行空板 K10
    */
    #include "unihiker_k10.h"
    #include "DFRobot_HuskylensV2.h"
	#include <DFRobot_HTTPClient.h>
    #include <DFRobot_Iot.h>

    // 动态变量
    volatile float mind_n_a, mind_n_b, mind_n_c, mind_n_JinDu;
    volatile bool autoMode = true;

    // 创建对象
    HuskylensV2 huskylens;
    UNIHIKER_K10 k10;
    DFRobot_HTTPClient http;
    DFRobot_Iot myIot;
    uint8_t screen_dir=2;

    void DF_ShiBieShouShiJieGuo();
    void DF_LiuChengQiDong();
    void DF_ShuaXinPingMuWenZi(String mind_s_string, float mind_n_row);
    void onButtonAUnPressed();
    void onButtonBUnPressed();
    void DF_TextColor(String s, float row, uint32_t color);
    void DF_ShowStatus(String s);
    void DF_ShowHint(String s);
    void DF_ShowProgress(int step, String detail);
    void DF_ClearRows(int fromRow, int toRow);
    void DF_UpdateModeHint();
    void DF_ResetFlow();
    void onButtonABPressed();
    void sendStep(String step);
    void sendResetCmd();

    const uint32_t COL_TITLE = 0xFF66CC;
    const uint32_t COL_HINT = 0x66CCFF;
    const uint32_t COL_PENDING = 0x999999;
    const uint32_t COL_SUCCESS = 0x33DD77;
    const uint32_t COL_FINAL = 0xFF6699;
    const uint32_t COL_INFO = 0x00AAFF;
    const uint32_t COL_WARN = 0xFFCC66;

    // 主程序开始
    void setup() {
        k10.begin();
        k10.buttonA->setUnPressedCallback(onButtonAUnPressed);
        k10.initScreen(screen_dir);
        k10.creatCanvas();
        k10.buttonB->setUnPressedCallback(onButtonBUnPressed);
        k10.buttonAB->setPressedCallback(onButtonABPressed);
        Wire.begin();
        while (!huskylens.begin(Wire)) {
            delay(100);
        }
        huskylens.switchAlgorithm(ALGORITHM_HAND_RECOGNITION);
        delay(5000);
        DF_TextColor("行空版", 1, COL_TITLE);
        // WiFi 连接
        myIot.wifiConnect("BCM-RJ", "bcm123456");
        while (!myIot.wifiStatus()) {}
        DF_ShowStatus("WiFi已连接");
        DF_ShowStatus("系统就绪");
        DF_UpdateModeHint();
        DF_LiuChengQiDong();
    }
    void loop() {
        if (autoMode) {
            if (mind_n_JinDu==1) {
                DF_ShiBieShouShiJieGuo();
                if (mind_n_a>2) {
                    DF_TextColor((String("识别到：") + String(RET_ITEM_STR(huskylens.getCachedResultByID(ALGORITHM_HAND_RECOGNITION, 1), Result, name))), 5, COL_SUCCESS);
                    sendStep("step1");
                    DF_ShowProgress(1, "完成");
                    mind_n_b = 0;
                    mind_n_JinDu = 2;
                }
            } else if (mind_n_JinDu==2) {
                DF_ShiBieShouShiJieGuo();
                if (mind_n_b>2) {
                    DF_TextColor((String("识别到：") + String(RET_ITEM_STR(huskylens.getCachedResultByID(ALGORITHM_HAND_RECOGNITION, 2), Result, name))), 7, COL_SUCCESS);
                    sendStep("step2");
                    DF_ShowProgress(2, "完成");
                    mind_n_c = 0;
                    mind_n_JinDu = 3;
                }
            } else if (mind_n_JinDu==3) {
                DF_ShiBieShouShiJieGuo();
                if (mind_n_c>2) {
                    DF_TextColor((String("识别到：") + String(RET_ITEM_STR(huskylens.getCachedResultByID(ALGORITHM_HAND_RECOGNITION, 3), Result, name))), 9, COL_SUCCESS);
                    sendStep("step3");
                    DF_TextColor("科技节启动", 11, COL_FINAL);
                    mind_n_JinDu = 4;
                }
            }
        }
    }

    // 自定义函数
    void sendStep(String step) {
        http.init();
        String url = "https://launchapi.ljcode.cn/api/steps/trigger?apiKey=iot-secret&step=" + step;
        http.GET(url, 10000);
    }

    void sendResetCmd() {
        http.init();
        // Reset 接口使用 GET + 参数
        String url = "https://launchapi.ljcode.cn/api/steps/reset?apiKey=iot-secret";
        http.GET(url, 10000);
    }

    void DF_ShiBieShouShiJieGuo() {
        mind_n_a = 0;
        mind_n_b = 0;
        mind_n_c = 0;
        for (int index = 0; index < 3; index++) {
            huskylens.getResult(ALGORITHM_HAND_RECOGNITION);
            if (huskylens.available(ALGORITHM_HAND_RECOGNITION)) {
                if ((huskylens.getCachedResultByID(ALGORITHM_HAND_RECOGNITION, 1) != NULL)) {
                    mind_n_a += 1;
                }
                else if ((huskylens.getCachedResultByID(ALGORITHM_HAND_RECOGNITION, 2) != NULL)) {
                    mind_n_b += 1;
                }
                else if ((huskylens.getCachedResultByID(ALGORITHM_HAND_RECOGNITION, 3) != NULL)) {
                    mind_n_c += 1;
                }
                else {
                }
            }
            delay(100);
        }
    }
    void DF_LiuChengQiDong() {
        // HTTP模式下不发送 step0
        DF_ClearRows(3,11);
        DF_TextColor("准备启动流程", 3, COL_INFO);
        DF_TextColor("", 4, COL_PENDING);
        DF_TextColor("手势1 待识别", 5, COL_PENDING);
        DF_TextColor("", 6, COL_PENDING);
        DF_TextColor("手势2 待识别", 7, COL_PENDING);
        DF_TextColor("", 8, COL_PENDING);
        DF_TextColor("手势3 待识别", 9, COL_PENDING);
        DF_TextColor("", 10, COL_PENDING);
        mind_n_a = 0;
        mind_n_b = 0;
        mind_n_c = 0;
        mind_n_JinDu = 1;
        if (!autoMode) {
            DF_ShowProgress(1, "待手动激活");
            DF_ShowProgress(2, "待手动激活");
            DF_ShowProgress(3, "待手动激活");
        }
    }
    void DF_ShuaXinPingMuWenZi(String mind_s_string, float mind_n_row) {
        k10.canvas->canvasClear(mind_n_row);
        k10.canvas->canvasText(mind_s_string, mind_n_row, 0x0000FF);
        k10.canvas->updateCanvas();
    }

    void DF_TextColor(String s, float row, uint32_t color) {
        k10.canvas->canvasClear(row);
        k10.canvas->canvasText(s, row, color);
        k10.canvas->updateCanvas();
    }

    void DF_ShowStatus(String s) {
        DF_TextColor(s, 1, COL_INFO);
    }

    void DF_ShowHint(String s) {
        DF_TextColor(s, 3, COL_HINT);
    }

    void DF_ShowProgress(int step, String detail) {
        if (step==1) DF_TextColor((String("手势1 ") + detail), 5, COL_SUCCESS);
        if (step==2) DF_TextColor((String("手势2 ") + detail), 7, COL_SUCCESS);
        if (step==3) DF_TextColor((String("手势3 ") + detail), 9, COL_SUCCESS);
    }

    void DF_ClearRows(int fromRow, int toRow) {
        for (int r=fromRow; r<=toRow; r++) {
            k10.canvas->canvasClear(r);
        }
        k10.canvas->updateCanvas();
    }
    void DF_UpdateModeHint() {
        if (autoMode) {
            DF_TextColor("模式：自动识别  按A键切换  A+B重置", 3, COL_HINT);
        } else {
            DF_TextColor("模式：手动识别  按A键切换  A+B重置", 3, COL_HINT);
        }
    }

    // 事件回调函数
    void onButtonAUnPressed() {
        autoMode = !autoMode;
        DF_UpdateModeHint();
    }
    void onButtonBUnPressed() {
        if ((mind_n_JinDu==1)) {
            DF_TextColor((String("手动激活：") + String("1")), 5, COL_WARN);
            sendStep("step1");
            DF_ShowProgress(1, "已手动激活");
            mind_n_JinDu = 2;
        }
        else if ((mind_n_JinDu==2)) {
            DF_TextColor((String("手动激活：") + String("2")), 7, COL_WARN);
            sendStep("step2");
            DF_ShowProgress(2, "已手动激活");
            mind_n_JinDu = 3;
        }
        else if ((mind_n_JinDu==3)) {
            DF_TextColor((String("手动激活：") + String("3")), 9, COL_WARN);
            sendStep("step3");
            DF_TextColor("科技节启动", 11, COL_FINAL);
        }
        else {
            DF_TextColor("按A+B键，重置", 11, COL_HINT);
        }
    }
    void DF_ResetFlow() {
        sendResetCmd();
        mind_n_a = 0;
        mind_n_b = 0;
        mind_n_c = 0;
        mind_n_JinDu = 1;
        autoMode = true;
        DF_UpdateModeHint();
        DF_LiuChengQiDong();
    }
    void onButtonABPressed() {
        DF_ResetFlow();
    }
