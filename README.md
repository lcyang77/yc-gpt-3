#getcourseDetails.js?v=0508
layui.use(['webconfig', 'common', 'layer', 'jquery', 'form', 'element'], function () {
  var $ = layui.jquery;
  var webconfig = layui.webconfig;
  var common = layui.common;
  var layer = layui.layer;
  var element = layui.element;
  var form = layui.form;
  var rate = layui.rate;

  if (!webconfig.getToken(true)) { //判断是否登录
    return;
  }

  var playinfo = layui.data(webconfig.tableName).playinfo;
  var mskInfo = {
    divid: 'studyVideoRoot',
    mskId: 'tmpMsk',
    ishow: false
  };
  var isFirefox = navigator.userAgent.indexOf("Firefox") > 0;
  var jid = playinfo.jid;
  var courseid = playinfo.courseid;
  var classesId = playinfo.classesId;
  var getchapterId = playinfo.chapterId;
  var classYear = playinfo.classYear;
  var learningToken = ""; //学习token
  var heartSec = 120; //心跳记录间隔
  var lastTime = 0; //初始播放时间点
  var playtimer = null; //定时器
  var playTime = 0; //当前计时器播放时长
  var currentPlayTime = 0; //当前播放器进度
  var currentDuration = 0; //当前视频时长
  var submitTime = 0; //待提交时长
  var countJ = 0; //目录章节数 
  var isFullscreen = false; //是否为全屏状态 
  var vedioUrl = ""; //视频地址
  var classDurationTotal = 0; //要求学时
  var learnLengthAll = 0; //已学学时
  var playend = false; //是否为播放结束 
  var canplaythrough = false; //是否可流畅播放
  var constBuffLen = 60; //网络卡顿时视频缓冲时长(video缓冲30秒判断为可流畅播放)
  var currentNodeLookedLength = 0; //已看时长(包括提交成功的)
  var playing = false; //正在播放标识
  var errorFlag = false; //出错标识
  var heartbeating = false; //心跳是否请求中
  var taotalTimes = 0; //课程总时长
  var studentId = webconfig.getUser().id; //学员ID
  var firstCourseTypeId = ''; //课程类型
  var szhy = webconfig.getUser().szhy; //判断是否是卫健学员
  if (szhy == '01' || szhy == '11') {
    $("#wjclassPeriod").hide();
    $(".iconYellow").hide();
    $(".itemTime").hide();
  }

  //默认点击“未学完”
  $("#study").trigger("click");

  //点击“未学完”，显示未学完的课程，隐藏未合格的课程
  $("#study").on("click", function () {
    $(".carouselStudy").show();
    $(".carouselExam").hide();
  });

  //点击“未合格”，隐藏未学完的课程，显示未合格的课程
  $("#exam").on("click", function () {
    $(".carouselStudy").hide();
    $(".carouselExam").show();
  });

  // 实例化播放器
  var player = new Player({
    id: 'studyVideo',
    width: "750",
    height: "580",
    "fluid": true,
    lang: 'zh-cn',
    disableProgress: true
  });
  /* 将秒数换成时分秒格式  */
  window.formatSeconds2 = function (a) {
    var hh = parseInt(a / 3600);
    if (hh < 10) hh = "0" + hh;
    var mm = parseInt((a - hh * 3600) / 60);
    if (mm < 10) mm = "0" + mm;
    var ss = parseInt((a - hh * 3600) % 60);
    if (ss < 10) ss = "0" + ss;
    var length;
    if (hh > 0) {
      length = hh + ":" + mm + ":" + ss;
    } else {
      length = mm + ":" + ss;
    }
    if (a > 0) {
      return length;
    } else {
      return "00:00";
    }
  };
  window.resetParams = function () {
    learningToken = ""; //学习token
    lastTime = 0; //初始播放时间点 
    playTime = 0; //当前计时器播放时长
    currentPlayTime = 0; //当前播放器进度
    currentDuration = 0; //当前视频时长
    submitTime = 0;
    countJ = 0; //目录章节数 
    vedioUrl = ""; //视频地址
    playend = false; //是否为播放结束 
    canplaythrough = false; //是否可流畅播放
    errorFlag = false; //出错标识
    heartbeating = false;

    clearInterval(playtimer);
  };
  window.videoMsk = function (ishow) {
    if (mskInfo.ishow != ishow) {
      mskInfo.ishow = ishow;
      myMsk(mskInfo);
      updateBuffProgress(0);
    }
  };
  window.submitLoading = function (ishow) {
    return myMsk({
      divid: 'studyVideoRoot',
      type: 1,
      ishow: ishow
    });
  };
  window.updateBuffProgress = function (v) {
    $("#" + mskInfo.mskId + "_progress").html(v > 100 ? 100 : v);
  };
  window.handleEnded = function (player, learnStatus) {
    if (isFullscreen) {
      player.exitFullscreen(player.root); //退出全屏
    }
    if (learnStatus == 2) {
      //已学完的直接设置为已看完
      playend = true;
    } else {
      //未学完的判断已学时长是否足够
      var lookedLen = parseInt(playTime) + parseInt(lastTime);
      var diffLen = lookedLen - parseInt(currentDuration);
      if (diffLen >= 0) {
        //标记已学完
        playend = true;
      } else {
        //用来提示有拖动或倍速播放的人员
        var i = 5;
        var interval;
        var idxf = layer.confirm("当前节观看时长不足，需要继续观看此课程", {
          title: ['温馨提示', 'font-weight:bold'],
          btn: ['确定'],
          skin: 'my-skin',
          closeBtn: 0,
          icon: 7,
          area: ['350px', '300'],
          submit: function (idx) {
            layer.close(idx);
          },
          success: function (a, b) {
            //console.log('success');
            interval = setInterval(function () {
              $(".layui-layer-btn0").text('继续观看(' + i + ')');
              i--;
              if (i == 0) {
                clearInterval(interval); //清空倒计时
                layer.close(idxf); //关闭提示
                player.currentTime = lookedLen; //记忆播放
                learningToken = ""; //清空token
                player.play(); //开始播放
              }
            }, 1000);
          },
          end: function () {
            // console.log('end');
            clearInterval(interval);
            if (i > 0) {
              player.currentTime = lookedLen; //记忆播放
              learningToken = ""; //清空token
              player.play();
            }
          }
        });
      }
    }
  };

  window.autoScroll = function (jid) {
    $("#courseCatalogue").animate({
      scrollTop: $("#courseCatalogue").scrollTop() + $('#node_' + jid).offset().top - $('#courseCatalogue').offset().top
    }, 1000);
  };
  // 请求视频资源
  window.watchAfew = function (jid, chapterId, learnLength, getlearnStatus) {
    //定位滚动条
    autoScroll(jid);
    var learnStatus = getlearnStatus;
    resetParams();
    $.ajax({
      url: webconfig.base_server + "/course/api/course/coursesectionresourceref/getCourseSectionResourceRefBySectionId/" + jid,
      contentType: "application/x-www-form-urlencoded",
      type: 'get',
      success: function (data) {
        if (common.isApiData(data)) {
          var url = data.data[0].url;
          // 视频初始赋值
          $("#studyVideo").empty();
          player = new Player({
            id: 'studyVideo',
            width: "750",
            height: "580",
            "fluid": true,
            lang: 'zh-cn',
            autoplay: true,
            lastPlayTime: learnLength == -1 ? 0 : learnLength,
            lastPlayTimeHideDelay: 3,
            ignores: ['replay'],
            url: url,
            allowSeekPlayed: learnStatus != 2,
            //"disableProgress": learnStatus != 2
          });
          player.once('ready', () => {
            ////console.log('ready')
          });
          currentNodeLookedLength = learnLength; //已看时长 

          player.on('bufferedChange', function (buffRanges) {
            if (buffRanges.length > 0) {
              ////console.log("bufferedChange", "canplaythrough:" + canplaythrough);
              var buffLen = buffRanges[buffRanges.length - 1][1] - player.currentTime; //剩余缓冲时长
              var buffProgress = Math.floor(buffLen / constBuffLen * 100);
              if (canplaythrough) {
                //可以流畅播放 
                if (mskInfo.ishow) { //隐藏缓冲中提示
                  player.play();
                  videoMsk(false);
                }
              } else {
                if (buffProgress >= 100) { //缓冲大于或等于100认定为可流畅播放
                  canplaythrough = true;
                }
                if (canplaythrough) {
                  if (mskInfo.ishow) { //隐藏缓冲中提示
                    player.play();
                    videoMsk(false);
                  }
                } else {
                  if (playing) {
                    player.pause(); //暂停并请求心跳
                  }
                  //显示缓冲中提示并更新缓冲进度
                  videoMsk(true);
                  updateBuffProgress(buffProgress >= 0 ? buffProgress : 0);
                }
              }

            }
          });

          //等待加载数据
          player.on('waiting', function () {
            if (!canplaythrough) {
              ////console.log("waiting");
              player.pause(); //停止播放
              videoMsk(true); //网络不好卡顿，显示遮罩视频缓冲中
            }
          });
          //视频可以流畅播放
          player.on('canplaythrough', function () {
            canplaythrough = true;
            ////console.log('canplaythrough');
          });

          //player.start(url);
          if (learnLength == -1) {
            lastTime = 0;
          } else {
            lastTime = learnLength;
          }
          // 自动播放
          player.on('canplay', function () {
            ////console.log("canplay");
            if (url != vedioUrl) {
              vedioUrl = url;
              player.play();
              setTimeout(function () {
                if (!player.hasStart && isFirefox) {
                  parent.layer.open({
                    title: ['<h1 style="color:#ab030c">温馨提示</h1>'],
                    content: '<center>当前浏览器不允许视频自动播放<br>如果您想开启自动播放，请点击<a onclick=window.open("/helpContent.html?id=null&type=list&categoryId=16")>开启允许视频自动播放</a>查看如何开启</center>',
                    skin: 'my-skin1',
                    area: ['500px', '200px'],
                    btn: ['开始播放'],
                    btnAlign: 'c',
                    closeBtn: 0,
                    yes: function (index, layero) {
                      player.play();
                      parent.layer.close(index);
                    }
                  });
                }
              }, 3000);
            }
          });

          // 监听进入全屏状态
          player.on('requestFullscreen', function () {
            isFullscreen = true;
          });
          // 监听退出全屏状态
          player.on('exitFullscreen', function () {
            isFullscreen = false;
          });
          // 监听播放
          player.on('timeupdate', function () {
            //currentPlayTime = player.currentTime;
            playing = true;
          });
          //监听元数据加载完成
          player.on('loadedmetadata', function () {
            currentDuration = player.duration;
          });
          // 播放暂停
          player.on('pause', function () {
            playing = false;
            var tmpSubmitTime = submitTime; //暂存待提交时长
            clearInterval(playtimer); //清空定时器
            var restLen = parseInt(currentDuration) - parseInt(playTime) - parseInt(lastTime);
            //console.log("pause", restLen, tmpSubmitTime, parseInt(playTime), parseInt(lastTime), parseInt(currentDuration));
            if (errorFlag) { //错误不做提交
              //console.log("error pause not submit");
              errorFlag = false;
            } else {
              submitTime = 0; //重置提交缓冲时长
              //console.log("pause ok", learningToken);
              if (learnStatus != 2) { //没有看完的
                //没有错误
                if (tmpSubmitTime > 0) { //待提交时长大于1秒
                  if (restLen < 3) {
                    //视频最后一次提交
                    playTime++; //最后加1秒
                    tmpSubmitTime++; //最后加1秒
                    var slIdx = submitLoading(true);
                    setTimeout(function () {
                      sendheartbeat(chapterId, tmpSubmitTime, learnStatus, function () {
                        $("#" + slIdx).remove(); //移除遮罩
                        //console.log('最后提交数据ok');
                        //效验数据  此方法会自动判断标记是否已真实学完
                        handleEnded(player, learnStatus);
                      });
                    }, 2000);
                  } else {
                    sendheartbeat(chapterId, tmpSubmitTime, learnStatus, function () {
                      //回调
                      learningToken = ""; //清空token
                      //console.log('数据提交ok');
                    });
                  }
                } else {
                  learningToken = ""; //清空token
                }
              } else {
                //已看完的
                if (parseInt(player.currentTime) >= parseInt(player.duration)) { //到进度条最后了
                  handleEnded(player, learnStatus);
                }
                if (tmpSubmitTime > 1) {
                  sendheartbeat(chapterId, tmpSubmitTime, learnStatus);
                } else {
                  learningToken = ""; //清空token
                }
              }
            }

          });
          // 播放结束
          player.on('ended', function () {
            //ended事件触发器会先触发pause事件,因此ended事件不需提交数据
            //console.log('ended 事件触发');
            //handleEnded(player,learnStatus);
          });
          // 播放开始
          player.on('play', function () {
            //console.log('play', learningToken);
            videoMsk(false); //隐藏缓冲遮罩
            learningToken = ""; //开始播放清空token
            sendheartbeat(chapterId, 0); //发送初次请求

            playtimer = setInterval(function () {
              playTime++; //本次播放时长(不是播放器的时长)
              submitTime++; //提交时长(循环清空)
              var lookedLen = parseInt(playTime) + parseInt(lastTime);
              //console.log("计算时长:" + submitTime, "本次播放时长:" + playTime, "已学习时长:" + lookedLen,"当前播放器进度:" + player.currentTime, "当前视频时长:" + currentDuration);
              //最新版火狐101.0.1 (64 位)出现播放完成不触发结束暂停事件,手动判断是否播放完毕
              //当前播放大于等于视频时长
              // 剩余时间
              var restNodeId = "#shengyu" + jid;
              var restLen = parseInt(currentDuration) - lookedLen;
              restLen = restLen < 0 ? 0 : restLen;
              if (learnStatus == 2) {
                restLen = parseInt(currentDuration) - parseInt(player.currentTime);
              }
              $(restNodeId).removeClass("hide");
              $(restNodeId).addClass("redborder");
              $(restNodeId).text("剩余" + formatSeconds2(restLen));
              $(restNodeId).prev().css("width", "55%");
              //没有学完且播放器计时比定时器快了,将进度条拉回来
              if (learnStatus != 2 && parseInt(player.currentTime) > lookedLen) {
                player.currentTime = lookedLen; //拉回来
                //console.log('矫正');
              }

              if (isFirefox && !player.ended && !player.paused && parseInt(player.currentTime) >= parseInt(player.duration)) {
                if (submitTime > 1) {
                  //console.log("firefox 播放结束");
                  player.pause(); //交给播放暂停去提交数据 
                }
              } else {
                if (submitTime > 1 && submitTime % heartSec == 0) {
                  if (learningToken == "") {
                    //网速太慢上次请求还没完成 这种情况发生在网络极端不好的情况下
                    errorFlag = true; //标识此变量,后续暂停将不请求心跳
                    player.pause(); //暂停
                    player.currentTime = parseInt(playTime) + parseInt(lastTime); //将进度条拖回上一次提交时长
                    playTime = playTime - submitTime; //本次播放时长回退
                    //currentPlayTime = player.currentTime;
                    //开启数据提交中遮罩 
                    var slIdx = submitLoading(true);
                    //console.log('网络太慢提交数据等待中...', chapterId, submitTime, learnStatus);
                    sendheartbeat(chapterId, submitTime, learnStatus, function () {
                      learningToken = ""; //清空token
                      $("#" + slIdx).remove(); //移除遮罩
                      //console.log('网络太慢提交数据成功..', chapterId, submitTime, learnStatus);
                      //成功后重新开始播放
                      if (!playing || player.paused) {
                        player.play();
                      }
                    });
                    submitTime = 0;
                  } else {
                    //console.log("定时器提交数据:", parseInt(player.currentTime), parseInt(player.duration));
                    if ((parseInt(player.currentTime) + 1) >= parseInt(player.duration)) {
                      handleEnded(player, learnStatus);
                    }
                    sendheartbeat(chapterId, submitTime, learnStatus, function () { }); //提交数据
                    submitTime = 0;
                  }
                }
              }
            }, 1000);
          });
          // 播放错误时，点击刷新
          player.on('error', function (e) {
            //console.log('error', e);
          });
        }
      },
      error: function (xhr) {
        layer.closeAll('loading');
        //console.log("error");
        common.throwException(xhr);
      }
    });
  };
  window.onbeforeunload = function () {
    // if(!player.paused){
    //   var tmpSubmitTime = submitTime;
    //   submitTime =0;//暂存待提交时长后清空原始待提交时长与定时器
    //   clearInterval(playtimer);//清空定时器
    //   var restLen = parseInt(currentDuration)-parseInt(playTime)-parseInt(lastTime);
    //   if(!errorFlag){
    //     //没有错误
    //     if(tmpSubmitTime>1 && restLen>0){//待提交时长大于1秒
    //       sendheartbeat(playinfo.chapterId, tmpSubmitTime);
    //     }
    //   }
    // }
  };
  // 自动跳下一节
  window.jumpNext = function (chapterId) {
    playend = false;
    // 播完自动跳下一节
    if ($("#" + chapterId + "_" + jid).parent().next().length > 0) {
      layer.msg("本节播放结束,自动跳转下一节，请稍后...", {
        time: 2000,
        shade: [0.6, '#000', true]
      }, function () {
        $("#" + chapterId + "_" + jid).parent().next().click();
      });
    } else if ($("#" + chapterId + "_" + jid).parent().parent().next().length > 0) {
      layer.msg("本节播放结束,自动跳转下一节，请稍后...", {
        time: 2000,
        shade: [0.6, '#000', true]
      }, function () {
        $("#" + chapterId + "_" + jid).parent().parent().next().click();
      });
    } else {
      layer.msg('本节播放结束', function () {
        $("#shengyu" + jid).removeClass("redborder").addClass("hide").prev().css("width", "70%");
        //$("#shengyu"+jid).prev().css("width", "70%");
      });
    }
  };

  // 加载课程目录
  window.loadcatalogue = function (data) {
    var str = '';
    console.log(data)
    var strS = '<div><button class="layui-btn layui-btn-warm exam" style="background-color: #AB030C;float: right;margin-top: 8px;display:none;" onclick="toApplyExam()">申请考试</button></div>'
    for (var i = 0; i < data.length; i++) {
      var strZ = "",
        strJ = "";
      strZ += '<div class="list-item"><div class="item-title">' + data[i].name + '</div>';
      for (var j = 0; j < data[i].courseSections.length; j++) {
        var redClass = "";
        countJ++;
        if (data[i].courseSections[j].id == jid) {
          redClass = 'item-list-redClass';
          $("#headerCourseName").text(data[i].courseSections[j].name);
        } else {
          redClass = '';
        }
        strJ += '<div class="item-list ' + redClass + '" id="node_' + data[i].courseSections[j].id + '" onclick="changejid(this,\'' + data[i].courseSections[j].id + '\',\'' + data[i].courseSections[j].chapterId + '\')" title="' + data[i].courseSections[j].name + '">' +
          '<span class="item-list-content " style="float: left;width: 70px;"><span class="layui-badge-dot" style="margin-right:5px;background-color: #666;"></span>第' + (j + 1) + '节&nbsp;&nbsp;</span>' +
          '<span class="item-list-content chhide" style="display: block;float: left;width: 70%;">' + data[i].courseSections[j].name + '</span>' +
          '<span  class="layui-badge-rim layui-badge-rim-my hide" id="shengyu' + data[i].courseSections[j].id + '"></span>' +
          '<span class="item-list-progress" id="' + data[i].courseSections[j].chapterId + '_' + data[i].courseSections[j].id + '">0%</span>' +
          '<div class="clear"></div>' +
          '</div>';
      }
      strZ += strJ + '</div>';
      str += strZ + strS;
    }
    $("#courseCatalogue").append(str);
    initgetqueryListByStudentId(); //进度渲染
  };

  window.updateCurrentNodeProgress = function (id, addLength, needLength) {
    currentNodeLookedLength = Number(addLength) + Number(currentNodeLookedLength);
    var nodeProgress = Math.floor((Number(currentNodeLookedLength) / parseInt(needLength)) * 100);
    nodeProgress = nodeProgress >= 100 ? 100 : nodeProgress;
    //console.log('进度', nodeProgress, addLength, currentNodeLookedLength, needLength);
    $("#" + id).text(nodeProgress + "%");
  };

  var wrong = false;

  // 发送心跳
  window.sendheartbeat = function (chapterId, viewingLength, learnStatus, cb) {
    ////console.log(chapterId,learnStatus, viewingLength,playTime,currentPlayTime,currentDuration);

    // 获取token并判断用户是否登录
    if (!webconfig.getToken(true)) {
      parent.layer.open({
        title: ['<h1 style="color:#ab030c">提示</h1>'],
        content: '<p>登录超时或您已在别处登录，为了您的账号安全，请重新登录！</p>',
        skin: 'my-skin1',
        area: ['500px', '200px'],
        btn: ['确定'],
        btnAlign: 'c',
        closeBtn: 0,
        yes: function (index, layero) {
          parent.location.href = "/index.html";
          sessionStorage.setItem("isReload", true);
        }
      });
      // 用户凭证过期
      webconfig.removeToken(); //清除token
      webconfig.putUser(""); //缓存空用户信息
      return;
    }
    //console.log('提交数据', "课程id:" + courseid, "章id:" + chapterId, "节id:" + jid, "提交时长:" + viewingLength, "token:" + learningToken, "learnStatus：" + learnStatus);
    $.ajax({
      url: webconfig.base_server + "/learning/coursenoderecord/heartbeat",
      contentType: "application/json",
      headerToken: 'true',
      data: JSON.stringify({
        chapterId: chapterId,
        classesId: classesId,
        courseId: courseid,
        learningToken: learningToken,
        nodeId: jid,
        sourceType: 1,
        studentId: webconfig.getUser().id,
        viewingLength: viewingLength
      }),
      type: 'post',
      beforeSend: function () {
        //标记请求中
        heartbeating = true;
      },
      success: function (data) {
        if (wrong) {
          player.play();//开始播放
          videoMsk(false); //隐藏缓冲遮罩
        }
        if (common.isApiData(data)) {
          if ($.isFunction(cb)) {
            cb(data.data.status);
          }
          if (data.data.status == '0') {
            learningToken = data.data.data;
            taotalTimes += viewingLength;
            var theprogress = Math.floor(taotalTimes / classDurationTotal * 100);
            if (theprogress > 100) {
              theprogress = 100;
            } else if (theprogress < 0) {
              theprogress = 0;
            }
            element.progress('myprogress', theprogress + "%");
            $("#progressshow").text(theprogress + "%");
            if (theprogress == 100) { //已学完
              if ((szhy == '01' || szhy == '11') && firstCourseTypeId == 528) { //卫健学员并且是专业课程
                $.ajax({
                  url: webconfig.base_server + "/classes/frontClasses/getClassesInfoCoursePage",
                  contentType: "application/x-www-form-urlencoded",
                  type: 'GET',
                  headerToken: 'true',
                  dataType: 'json',
                  data: {
                    classesId: classesId,
                    customerId: studentId
                  },
                  success: function (data) {
                    var mycourseArr = data.data.records;
                    for (var i = 0; i < mycourseArr.length; i++) {
                      var courseId = mycourseArr[i].courseId;
                      if (courseId == courseid) {
                        var courseStatus = mycourseArr[i].courseStatus; //课程状态，0未学，1在学，2已学完，3已考完
                        if (courseStatus == 0 || courseStatus == 1) {
                          if (mycourseArr[i].examStatus == null || mycourseArr[i].examStatus == 0) {
                            layer.open({
                              title: '温馨提示',
                              content: '继续医学教育项目课程学习完成之后需要完成对应课程考试，考试合格才能进行项目学分申请，请稍后前往项目详情页面完成考试？',
                              area: ['350px'],
                              btnAlign: 'c',
                              closeBtn: 0,
                              btn: ['已知晓'],
                              yes: function (index) {
                                // toApplyExam();
                                layer.close(index);
                              },
                              end: function () {
                                $('.exam').css("background-color", "#AB030C");
                                $(".exam").attr("disabled", false);
                              }
                            });
                          }
                        } else if (courseStatus == 3) {
                          $('.exam').css("background-color", "#1AA034");
                          $('.exam').html("已合格");
                          $('.exam').attr('disabled', 'disabled');
                        }
                      }
                    }
                  },
                  error: function (xhr) {
                    common.throwException(xhr);
                  }
                });
              }
            } else {
              $('.exam').css("background-color", "#858585");
              $('.exam').attr('disabled', 'disabled');
            }
            //提交成功时长大于0且未看完
            if (viewingLength > 0 && learnStatus != 2) {
              updateCurrentNodeProgress(chapterId + "_" + jid, viewingLength, currentDuration);
            }
            if (playend) {
              jumpNext(chapterId);
            }
          } else if (data.data.status == '1') {
            errorFlag = true;
            player.pause();
            if (isFullscreen) {
              player.exitFullscreen(player.root);
            }
            if (data.data.data.indexOf("记录无效") > 0) {
              layer.confirm(data.data.data, {
                title: ['温馨提示', 'font-weight:bold'],
                btn: ['确定'], //按钮
                skin: 'my-skin',
                closeBtn: 0,
                area: ['500px', '300']
              }, function () {
                location.replace("/play.html?courseid=" + courseid + "&classesId=" + classesId);
              });
            } else {
              var i = 5;
              var interval;
              var idxf = layer.confirm(data.data.data, {
                title: ['温馨提示', 'font-weight:bold'],
                btn: ['确定'], //按钮
                skin: 'my-skin',
                closeBtn: 0,
                area: ['500px', '300'],
                success: function (a, b) {
                  //console.log('success');
                  interval = setInterval(function () {
                    $(".layui-layer-btn0").text('确定(' + i + ')');
                    i--;
                    if (i == 0) {
                      clearInterval(interval); //清空倒计时
                      layer.close(idxf); //关闭提示
                      window.location.reload(); //刷新当前页面
                    }
                  }, 1000);
                },
                end: function () {
                  //console.log('end');
                  clearInterval(interval);
                  if (i > 0) {
                    window.location.reload(); //刷新当前页面
                  }
                }
              });
            }
          } else if (data.data.status == '9999') {
            // //console.log(11111111, '请求频繁')
          } else {
            setTimeout(function () {
              learningToken = "";
              sendheartbeat(chapterId, 0);
            }, 3000)
          }
        }
      },
      complete: function () {
        heartbeating = false;
      },
      error: function (xhr) {
        errorFlag = true;
        player.pause();
        videoMsk(true); //显示缓冲遮罩
        wrong = true;
        setTimeout(function () {
          sendheartbeat(chapterId, viewingLength, learnStatus, cb);
        }, 3000)
        common.throwException(xhr);
        if (isFullscreen) {
          player.exitFullscreen(player.root);
        }
      }
    });
  };

  // 去我的课程
  window.jumpmycourse = function () {
    layui.data(webconfig.tableName, {
      key: 'centerWZ',
      value: "mycourse"
    });
    window.location.href = '/center.html?';
  };

  // 去考试
  window.toApplyExam = function () {
    var switchs = false;
    //播放开关
    $.ajax({
      url: webconfig.base_server + "/admin/dict/type/public/play_status",
      contentType: "application/x-www-form-urlencoded",
      type: 'get',
      success: function (data) {
        var dataTime = data.data;
        for (var i = 0; i < dataTime.length; i++) {
          if (dataTime[i].label) {
            if (classYear == dataTime[i].label) {
              var date = new Date();
              //年 getFullYear()：四位数字返回年份
              var year = date.getFullYear(); //getFullYear()代替getYear()
              //月 getMonth()：0 ~ 11
              var month = date.getMonth() + 1;
              //日 getDate()：(1 ~ 31)
              var day = date.getDate();
              var times = year + '-' + month + '-' + day;
              var timestamp = Date.parse(times);//当前时间戳
              var startTime = dataTime[i].value.substr(0, 10);//开始时间
              var endTime = dataTime[i].value.substr(11, 21);//结束时间
              var startTimeStamp = Date.parse(new Date(startTime));//转换为时间戳
              var endTimeStamp = Date.parse(new Date(endTime));//转换为时间戳
              switchs = true;
              if (startTimeStamp <= timestamp && timestamp <= endTimeStamp) {
                $.ajax({
                  url: webconfig.base_server + "/exam/studentexaminfo/applyExam",
                  contentType: "application/json",
                  headerToken: 'true',
                  type: 'post',
                  data: JSON.stringify({
                    init: 1,
                    examType: 2,
                    relationId: courseid
                  }),
                  success: function (data) {
                    layer.closeAll('loading');
                    if (common.isApiData(data)) {
                      var examVo = data.data.data;
                      if (examVo && examVo != null) {
                        $.ajax(webconfig.base_server + '/exam/faceauthenticationinformation/getByIdNumber', {
                          headerToken: 'true',
                          type: 'post',
                          dataType: 'json',
                          data: {
                            idNumber: webconfig.getUser().username,
                            studentId: webconfig.getUser().id,
                          },
                          success: function (jsondata) {
                            if (jsondata.data == null || jsondata.data.realNameAuthenticationStatus == 0 || jsondata.data.realNameAuthenticationStatus == null) {
                              // 去实名认证
                              layui.data(webconfig.tableName, {
                                key: 'centerWZ',
                                value: "myset"
                              });
                              layui.data(webconfig.tableName, {
                                key: 'centerWZ',
                                value: "myauthentication"
                              });
                              var str = '/center.html';
                              parent.location.href = str;
                            } else if (jsondata.data.realNameAuthenticationStatus == '1') {
                              $.ajax({
                                url: webconfig.base_server + "/classes/frontClasses/getClassesInfo/" + classesId,
                                contentType: "application/x-www-form-urlencoded",
                                type: 'GET',
                                headerToken: 'true',
                                dataType: 'json',
                                data: {
                                  id: classesId,
                                  customerId: studentId
                                },
                                success: function (data) {
                                  var rating = data.data.rating;
                                  if (rating != null) {
                                    parent.layer.open({
                                      type: 2,//类型
                                      title: '',//窗口名字
                                      maxmin: false,
                                      closeBtn: 1,
                                      shadeClose: false,//点击遮罩不关闭层
                                      area: ['90%', '90%'],//定义宽和高
                                      content: '../template/examination/instructionsToCandidates.html?courseId=' + courseid,//打开的内容
                                      success: function (layero, index) {

                                      },
                                      cancel: function () {
                                        window.location.reload();//刷新当前页面
                                      }
                                    })
                                  } else {
                                    appraise();
                                  }
                                },
                                error: function (xhr) {
                                  common.throwException(xhr);
                                }
                              });
                            }
                          },
                          error: function (xhr) {
                            common.throwException(xhr);
                          }
                        })
                      } else {
                        layer.msg('请学完课程后再开始考试，如已完成请耐心等待数据同步后再开始考试', {
                          icon: 1,
                        }, function () {
                          window.close();
                        });
                      }
                    }
                  }
                });
              } else {
                $.ajax({
                  url: webconfig.base_server + "/admin/dict/type/public/wjCourse_switch_tips",
                  contentType: "application/x-www-form-urlencoded",
                  type: "get",
                  success: function (data) {
                    if (common.isApiData(data)) {
                      var getCallListStr = "";
                      $(data.data).each(function (index, item) {
                        getCallListStr += '<p style="margin-top:3px;text-indent:2em;">' + item.value + '</p>';
                      });
                      parent.layer.open({
                        title: '<div style="font-size:17px;">温馨提示</div>',
                        content: '<div style="font-size:17px;">' + getCallListStr + '</div>',
                        btnAlign: 'c',
                        closeBtn: 0,
                        area: ['800px'],
                        btn: ['我知道了'],
                        yes: function (index) {
                          parent.layer.close(index)
                        }
                      });
                    }
                  },
                  error: function (xhr) {
                    common.throwException(xhr);
                  }
                });
              }
            }
          }
        }
        if (!switchs) {
          $.ajax({
            url: webconfig.base_server + "/exam/studentexaminfo/applyExam",
            contentType: "application/json",
            headerToken: 'true',
            type: 'post',
            data: JSON.stringify({
              init: 1,
              examType: 2,
              relationId: courseid
            }),
            success: function (data) {
              layer.closeAll('loading');
              if (common.isApiData(data)) {
                // console.log(data)
                var examVo = data.data.data;
                // console.log(examVo);
                if (examVo && examVo != null) {
                  $.ajax(webconfig.base_server + '/exam/faceauthenticationinformation/getByIdNumber', {
                    headerToken: 'true',
                    type: 'post',
                    dataType: 'json',
                    data: {
                      idNumber: webconfig.getUser().username,
                      studentId: webconfig.getUser().id,
                    },
                    success: function (jsondata) {
                      if (jsondata.data == null || jsondata.data.realNameAuthenticationStatus == 0 || jsondata.data.realNameAuthenticationStatus == null) {
                        // 去实名认证
                        layui.data(webconfig.tableName, {
                          key: 'centerWZ',
                          value: "myset"
                        });
                        layui.data(webconfig.tableName, {
                          key: 'centerWZ',
                          value: "myauthentication"
                        });
                        var str = '/center.html';
                        parent.location.href = str;
                      } else if (jsondata.data.realNameAuthenticationStatus == '1') {
                        $.ajax({
                          url: webconfig.base_server + "/classes/frontClasses/getClassesInfo/" + classesId,
                          contentType: "application/x-www-form-urlencoded",
                          type: 'GET',
                          headerToken: 'true',
                          dataType: 'json',
                          data: {
                            id: classesId,
                            customerId: studentId
                          },
                          success: function (data) {
                            var rating = data.data.rating;
                            if (rating != null) {
                              parent.layer.open({
                                type: 2,//类型
                                title: '',//窗口名字
                                maxmin: false,
                                closeBtn: 1,
                                shadeClose: false,//点击遮罩不关闭层
                                area: ['90%', '90%'],//定义宽和高
                                content: '../template/examination/instructionsToCandidates.html?courseId=' + courseid,//打开的内容
                                success: function (layero, index) {

                                },
                                cancel: function () {
                                  window.location.reload();//刷新当前页面
                                }
                              })
                            } else {
                              appraise();
                            }
                          },
                          error: function (xhr) {
                            common.throwException(xhr);
                          }
                        });
                      }
                    },
                    error: function (xhr) {
                      common.throwException(xhr);
                    }
                  })
                } else {
                  layer.msg('请学完课程后再开始考试，如已完成请耐心等待数据同步后再开始考试', {
                    icon: 1,
                  }, function () {
                    window.close();
                  });
                }
              }
            }
          });
        }
      },
      error: function (xhr) {
        common.throwException(xhr);
      }
    });
  };

  //基础效果
  rate.render({
    elem: '#ratingId',
    half: true,
    text: true,
    value: 10,
    setText: function (value) {
      $("#rating").val(value * 2);
      this.span.text(value * 2 + "分");
    }
  })

  //评价
  window.appraise = function () {
    var dialoag = layer.open({
      type: 1,
      resize: false,
      title: ['项目评分（请先完成项目评分再申请考试！）', 'font-size:18px;color:#fff;background:#ab030c'],
      area: ['500px', '320px'],
      skin: "my-skin1",
      btnAlign: 'c',
      // closeBtn:0,
      content: $("#appraiseDiv"),
      cancel: function (index, layero) {
        layer.close(index)
        $('#appraiseDiv').hide();
        return true;
      },
      success: function (layero) {
        layer.close();
        layero.find('.layui-layer-content').css('overflow', 'visible');
        form.render().on('submit(*)', function () {
          layer.load();
          var rating = $("#rating").val();
          var content = $("#content").val();
          $.ajax({
            url: webconfig.base_server + "/classes/classesratinginfo/fontAddRating",
            contentType: "application/json",
            type: 'POST',
            data: JSON.stringify({
              classesId: classesId,
              studentId: studentId,
              rating: rating,
              content: content,
            }),
            headerToken: 'true',
            success: function (data) {
              layer.closeAll();
              $('#appraiseDiv').hide();
              if (common.isApiData(data)) {
                layer.msg("评价成功", {
                  shift: -1,
                  time: 1000,
                }, function () {
                  pj = 1
                  window.location.reload();
                  $('#appraiseDiv').hide();
                });
              }
            },
            error: function (xhr) {
              common.throwException(xhr);
            }
          });
        });
      }
    });
  };

  // 收起目录
  window.shouqimulu = function (obj) {
    // var player = videojs("studyVideo");
    if ($(obj).text() == "收起目录") {
      $(".topic-list").css("display", "none");
      $(".video-container").css("width", "100%");
      $("#studyVideo").css("width", "1200px");
      $(obj).text("打开目录");
    } else {
      $(".topic-list").css("display", "block");
      $(".video-container").css("width", "");
      $("#studyVideo").css("width", "750px");
      $(obj).text("收起目录");
    }
  };

  // 获取课程信息
  $.ajax({
    url: webconfig.base_server + "/course/api/course/coursebaseinfo/" + courseid,
    contentType: "application/x-www-form-urlencoded",
    type: 'get',
    success: function (data) {
      if (common.isApiData(data)) {
        var courseObj = data.data;
        if (courseObj) {
          firstCourseTypeId = courseObj.firstCourseTypeId;
          var mycourseTypeName = "";
          var myclassPeriod = (courseObj.classPeriod / 3600).toFixed(1);
          $("#courseName").text(courseObj.name);
          if (courseObj.firstCourseTypeId == common.publicParm) {
            mycourseTypeName = "公共科目";
          } else {
            mycourseTypeName = courseObj.courseTypeName;
          }
          $("#mycourseTypeName").text(mycourseTypeName);
          $("#myclassPeriod").text(myclassPeriod);
          // $("#headerCourseName").html(courseObj.name);
          classDurationTotal = Number(courseObj.classDurationTotal);
        }
      }
    },
    error: function (xhr) {
      common.throwException(xhr);
    }
  });
  // 请求视频目录
  window.getcatalogue = function () {
    $.ajax({
      url: webconfig.base_server + "/course/api/course/coursebaseinfo/catalogue/" + courseid,
      contentType: "application/x-www-form-urlencoded",
      type: 'get',
      data: {
        classesId: classesId
      },
      success: function (data) {
        if (common.isApiData(data)) {
          var getClassid = classesId;
          loadcatalogue(data.data, courseid);
        }
      },
      error: function (xhr) {
        common.throwException(xhr);
      }
    });
  };
  //点击收藏按钮
  $("#infostore").click(function () {
    if (!webconfig.getToken(true)) { //判断是否登录
      return;
    }
    $.ajax({
      url: webconfig.base_server + "/course/safe/api/course/coursebaseinfostore/store/" + courseid,
      contentType: "application/x-www-form-urlencoded",
      type: 'GET',
      headerToken: 'true',
      success: function (data) {
        if (common.isApiData(data)) {
          isStore();
          // //console.log(data)
        }
      },
      error: function (xhr) {
        common.throwException(xhr);
      }
    });
  });
  //收藏样式切换
  window.changeInfostore = function (flag) {
    if (flag) {
      $("#infostore").attr("class", "layui-btn");
      $("#infostore label").html("已收藏");
      $("#infostore").css("background", "#AB030C");
      $("#infostore").css("border-color", "#AB030C");
      $("#infostore").css("color", "#fff");
    } else {
      $("#infostore").attr("class", "layui-btn layui-btn-primary");
      $("#infostore label").text("收藏");
      $("#infostore").css("background", "#FFFFFF");
      $("#infostore").css("border-color", "#d2d2d2");
      $("#infostore").css("color", "#666");
    }
  };

  //获取课程收藏信息
  window.isStore = function () {
    $.ajax({
      url: webconfig.base_server + "/course/safe/api/course/coursebaseinfostore/isStore/" + courseid,
      contentType: "application/x-www-form-urlencoded",
      type: 'GET',
      headerToken: 'true',
      success: function (data) {
        if (common.isApiData(data)) {
          changeInfostore(data.data);
        }
      },
      error: function (xhr) {
        common.throwException(xhr);
      }
    });
  };
  // 初始化查询全部学习进度
  window.initgetqueryListByStudentId = function () {
    $.ajax({
      url: webconfig.base_server + "/learning/coursenode/queryCurrentSections",
      contentType: "application/x-www-form-urlencoded",
      type: 'GET',
      data: {
        courseId: courseid,
        classesId: classesId
      },
      headerToken: 'true',
      success: function (data) {
        if (common.isApiData(data)) {
          var studyprogressArr = data.data;
          var progressSum = 0;
          if (studyprogressArr.length > 0) {
            var learnLengthSum = 0;
            for (var i = 0; i < studyprogressArr.length; i++) {
              classesId = studyprogressArr[i].classesId;
              var idname = studyprogressArr[i].chapterId + "_" + studyprogressArr[i].nodeId;
              var progress;
              learnLengthSum += Number(studyprogressArr[i].learnLength);
              if (studyprogressArr[i].learnStatus == 2) {
                progress = 100;
                learnLengthAll += Number(studyprogressArr[i].demandLength);
                // //console.log(Number(studyprogressArr[i].demandLength))
              } else {
                progress = Math.floor((Number(studyprogressArr[i].learnLength) / Number(studyprogressArr[i].demandLength)) * 100);
                if (progress > 100) {
                  progress = 100;
                  learnLengthAll += Number(studyprogressArr[i].demandLength);
                  // //console.log(Number(studyprogressArr[i].demandLength))
                } else {
                  learnLengthAll += Number(studyprogressArr[i].learnLength);
                  // //console.log(Number(studyprogressArr[i].learnLength))
                }
              }
              progressSum += progress;
              // //console.log(progress)
              $("#" + idname).text(progress + "%");
            }
            taotalTimes = learnLengthSum;
            // //console.log("learnLengthAll:" + learnLengthAll, "demandLengthSum:" + demandLengthSum);
            progressSum = Math.floor(learnLengthAll / classDurationTotal * 100);
            // progressSum = Math.floor(progressSum / countJ);
            // progressSum = Math.floor((learnLengthSum / demandLengthSum).toFixed(2) * 100);
          }
          if (progressSum > 100) {
            progressSum = 100;
          }

          element.progress('myprogress', progressSum + "%");
          $("#progressshow").text(progressSum + "%");
          if (progressSum == 100) {
            if ((szhy == '01' || szhy == '11') && firstCourseTypeId == '528') { //卫健学员并且是专业课程
              $.ajax({
                url: webconfig.base_server + "/classes/frontClasses/getClassesInfoCoursePage",
                contentType: "application/x-www-form-urlencoded",
                type: 'GET',
                headerToken: 'true',
                dataType: 'json',
                data: {
                  classesId: classesId,
                  customerId: studentId
                },
                success: function (data) {
                  var mycourseArr = data.data.records;
                  for (var i = 0; i < mycourseArr.length; i++) {
                    var courseId = mycourseArr[i].courseId;
                    if (courseId == courseid) {
                      var courseStatus = mycourseArr[i].courseStatus; //课程状态，0未学，1在学，2已学完，3已考完
                      if (courseStatus == 2) {
                        if (mycourseArr[i].examStatus == null || mycourseArr[i].examStatus == 0) {
                          layer.open({
                            title: '温馨提示',
                            content: '继续医学教育项目课程学习完成之后需要完成对应课程考试，考试合格才能进行项目学分申请，请稍后前往项目详情页面完成考试？',
                            area: ['350px'],
                            btnAlign: 'c',
                            closeBtn: 0,
                            btn: ['已知晓'],
                            yes: function (index) {
                              // toApplyExam();
                              layer.close(index);
                            }
                          });
                        }
                      } else if (courseStatus == 3) {
                        $('.exam').css("background-color", "#1AA034");
                        $('.exam').html("已合格");
                        $('.exam').attr('disabled', 'disabled');
                      }
                    }
                  }
                },
                error: function (xhr) {
                  common.throwException(xhr);
                }
              });
            }
          } else {
            $('.exam').css("background-color", "#858585");
            $('.exam').attr('disabled', 'disabled');
          }
          // 初始化请求视频资源
          if (jid && getchapterId) {
            getNewProgress("init", courseid, jid, getchapterId, classesId);
          }
        }
      },
      error: function (xhr) {
        common.throwException(xhr);
      }
    });
  };
  // 查询全部学习进度
  window.getAllProgress = function (jumpcourseid, classesId) {
    $.ajax({
      url: webconfig.base_server + "/learning/coursenode/queryCurrentSections",
      contentType: "application/x-www-form-urlencoded",
      type: 'GET',
      data: {
        courseId: jumpcourseid,
        classesId: classesId
      },
      headerToken: 'true',
      success: function (data) {
        if (common.isApiData(data)) {
          var studyprogressArr = data.data;
          // //console.log(studyprogressArr);
          if (studyprogressArr.length > 0) {
            $(studyprogressArr).each(function (index, item) {
              if (item.learnStatus != 2) {
                var tojid = item.nodeId;
                var tocourseid = item.courseId;
                var toclassesId = item.classesId;
                var tochapterId = item.chapterId;
                // //console.log(jumpcourseid,classesId)
                playinfo.jid = tojid;
                playinfo.chapterId = tochapterId;
                playinfo.classesId = toclassesId;
                playinfo.courseid = tocourseid;
                layui.data(webconfig.tableName, {
                  key: 'playinfo',
                  value: playinfo
                });
              }
            });
            location.reload("/getcourseDetails.html");
          } else {
            // getcatalogue();
            // 请求视频目录
            $.ajax({
              url: webconfig.base_server + "/course/api/course/coursebaseinfo/catalogue/" + jumpcourseid,
              contentType: "application/x-www-form-urlencoded",
              type: 'get',
              success: function (data) {
                if (common.isApiData(data)) {
                  $(data.data).each(function (index, item) {
                    $(item.courseSections).each(function (i, item_jie) {
                      var item_jid = item_jie.id;
                      var item_chapterId = item_jie.chapterId;
                      if (i == 0) {
                        playinfo.jid = item_jid;
                        playinfo.chapterId = item_chapterId;
                        playinfo.classesId = classesId;
                        playinfo.courseid = jumpcourseid;
                        layui.data(webconfig.tableName, {
                          key: 'playinfo',
                          value: playinfo
                        });
                      }
                    });
                  });
                  location.reload("/getcourseDetails.html");
                }
              },
              error: function (xhr) {
                common.throwException(xhr);
              }
            });
          }
          // location.reload("/getcourseDetails.html");
        }
      },
      error: function (xhr) {
        common.throwException(xhr);
      }
    });

  };
  // 查询当前节最新学习进度
  window.getNewProgress = function (type, courseId, nodeId, chapterId, classesId) {
    $.ajax({
      url: webconfig.base_server + "/learning/coursenode/getCourseNodeProgressRedis",
      contentType: "application/json",
      type: 'post',
      data: JSON.stringify({
        courseId: courseId,
        chapterId: chapterId,
        nodeId: nodeId,
        classesId: classesId
      }),
      headerToken: 'true',
      success: function (data) {
        if (common.isApiData(data)) {
          var studyprogressArr = data.data;
          var learnLength, demandLength;
          var setplaycurrenttime = 0;
          var learnStatus = "";
          var otherprogress = 0;
          var myprogress = 0;
          if (studyprogressArr) {
            learnLength = common.objIsNull(studyprogressArr.learnLength);
            demandLength = common.objIsNull(studyprogressArr.demandLength);
            learnStatus = common.objIsNull(studyprogressArr.learnStatus);
            var idname = studyprogressArr.chapterId + "_" + studyprogressArr.nodeId;
            var progress;
            if (learnStatus == 2) {
              progress = 100;
            } else {
              progress = Math.floor((Number(learnLength) / Number(demandLength)) * 100);
              if (progress >= 100) {
                progress = 100;
                learnStatus = 2;
              }
            }
            $("#" + idname).text(progress + "%");

            var progressshow = $("#progressshow").text();
            if (progressshow == "") {
              progressshow = 0;
            } else {
              progressshow = progressshow.substr(0, progressshow.length - 1);
            }
            myprogress = Math.floor((Number(learnLength) / Number(demandLength)) * 100);
            if (type == "init" && myprogress <= Number(progressshow) * countJ) { //假如是初始化
              otherprogress = Number(progressshow) * countJ - myprogress;
            }
            if (learnLength - demandLength >= 0) {
              setplaycurrenttime = -1;
            } else {
              setplaycurrenttime = learnLength;
            }
            lastTime = learnLength; //设置已观看进度
          }
          $('input[name="otherprogress"]').val(otherprogress);

          watchAfew(nodeId, chapterId, setplaycurrenttime, learnStatus);
        }
      },
      error: function (xhr) {
        common.throwException(xhr);
      }
    });
  };
  // 切换节
  window.changejid = function (obj, Cjid, CgetchapterId) {
    if (jid != Cjid) {
      $(obj).addClass("item-list-redClass");
      $(obj).siblings().removeClass("item-list-redClass");
      $("#headerCourseName").text($(obj).children(".item-list-content.chhide").text());
      $(".layui-badge-rim-my").addClass("hide");
      playinfo.jid = Cjid;
      playinfo.chapterId = CgetchapterId;
      layui.data(webconfig.tableName, {
        key: 'playinfo',
        value: playinfo
      });
      player.pause();
      if (isFullscreen) {
        player.exitFullscreen(player.root);
      }
      player.destroy();
      $("#studyVideo").empty();
      // player = new Player({
      //   id: 'studyVideo',
      //   width: "750",
      //   height: "580",
      //   "fluid": true,
      //   lang: 'zh-cn',
      //   ignores: ['replay']
      // });
      layer.msg("加载中请稍等...", {
        time: 2000,
        shade: [0.6, '#000', true]
      }, function () {
        //setTimeout(function () {
        playinfo = layui.data(webconfig.tableName).playinfo;
        jid = Cjid;
        getchapterId = CgetchapterId;
        getNewProgress("qie", courseid, Cjid, CgetchapterId, classesId);
        //}, 2000);
      });

    } else {
      if (player && (player.paused || player.ended)) {
        player.play();
      } else {
        layer.msg("您正在观看中，请勿重复点击", {
          time: 1500,
          shade: [0.6, '#000', true]
        });
      }
      autoScroll(jid);
    }
    // location.href = "/getcourseDetails.html?jid=" + Cjid + "&courseid=" + courseid + "&classesId=" + classesId + "&chapterId=" + CgetchapterId;
  };

  //加载班级课程
  $.ajax({
    url: webconfig.base_server + "/classes/frontClasses/getClassesInfoCoursePage",
    contentType: "application/x-www-form-urlencoded",
    type: 'GET',
    headerToken: 'true',
    dataType: 'json',
    data: {
      classesId: classesId,
      customerId: studentId
    },
    success: function (data) {
      var mycourseArr = data.data.records;
      // console.log(data)
      var str = "";
      var strs = "";
      var totalClassHours = 0;
      if (mycourseArr.length > 0) {
        var nolearn = 0; //未学习
        var amlearning = 0; //学习中
        var studyState = "";
        finishlearning = 0; //已学完
        qualified = 0; //考试合格
        for (var i = 0; i < mycourseArr.length; i++) {
          classesId = mycourseArr[i].classesId;
          id = mycourseArr[i].courseId;
          coverUrl = mycourseArr[i].coverUrl;
          classesYear = mycourseArr[i].classYear;
          if (!coverUrl) {
            coverUrl = "/images/public/zanwu.png";
          }
          var name = mycourseArr[i].name;
          classHour = (mycourseArr[i].byLearnLength / 3600).toFixed(1);
          totalClassHours += mycourseArr[i].byLearnLength;
          var courseLastLearnTime = mycourseArr[i].courseLastLearnTime;
          if (courseLastLearnTime == null) {
            courseLastLearnTime = '未开始';
          }
          if (mycourseArr[i].haveLearnLength == 0 || mycourseArr[i].needLearnLength == 0) {
            Lprogress = 0;
          } else {
            Lprogress = Math.floor((mycourseArr[i].haveLearnLength / mycourseArr[i].needLearnLength) * 100);
          }
          if (Lprogress > 100) {
            Lprogress = 100;
          }
          // console.log(Lprogress)
          courseStatus = mycourseArr[i].courseStatus; //课程状态，0未学，1在学，2已学完，3已考完
          if (courseStatus == 0) {
            studyState = '未学习';
            btnStr = '开始学习';
            btnClass = 'important';
            nolearn++;
            str += '<li class="banner listItems">' +
              '<img src="' + coverUrl + '" alt=""  onclick="goDetail(\'' + id + '\',\'' + classesId + '\')">' +
              '<div class="itemTitle">' + name + '</div>';
          } else if (courseStatus == 1 && Lprogress != 100) {
            studyState = '学习中';
            btnStr = '继续学习';
            btnClass = 'keep';
            amlearning++;
            str += '<li class="banner listItems">' +
              '<img src="' + coverUrl + '" alt=""  onclick="goDetail(\'' + id + '\',\'' + classesId + '\')">' +
              '<div class="itemTitle">' + name + '</div>';
          } else if ((courseStatus == 1 && Lprogress == 100) || courseStatus == 2) {
            studyState = '已学完';
            btnStr = '重复学习';
            btnClass = 'repeat';
            Lprogress = 100;
            finishlearning++;
            strs += '<li class="banner listItems">' +
              '<img src="' + coverUrl + '" alt="" onclick="toApplyExams(\'' + id + '\',\'' + classesYear + '\')">' +
              '<div class="itemTitle">' + name + '</div>';
          }
          str += '</li>';
          strs += '</li>';
        }
        totalClassHours = (totalClassHours / 3600).toFixed(1);
        if (nolearn + amlearning == 0) {
          $(".prevStudy").hide();
          $(".nextStudy").hide();
          str = "<div style='height:170px;font-size: 20px;text-align: center;line-height: 60px;color:#666;'><img src='/images/public/noFind.png' style='height:100%;'><p>课程已全部学完</p></div>";
        }
        if (finishlearning == 0 && nolearn + amlearning == 0) {
          $(".prevExam").hide();
          $(".nextExam").hide();
          strs = "<div style='height:170px;font-size: 20px;text-align: center;line-height: 60px;color:#666;'><img src='/images/public/noFind.png' style='height:100%;'><p>课程已全部合格</p></div>";
        }
        if (finishlearning == 0) {
          $(".prevExam").hide();
          $(".nextExam").hide();
          strs = "<div style='height:170px;font-size: 20px;text-align: center;line-height: 60px;color:#666;'><img src='/images/public/noFind.png' style='height:100%;'><p>暂无未合格数据</p></div>";
        }
        $(".incomplete").html(nolearn + amlearning);
        $(".unqualified").html(finishlearning);
        $("#courseCatalogues").append(str);
        $("#courseIntroduction").append(strs);
      }
      if ((szhy == '01' || szhy == '11') && firstCourseTypeId == 528) {
        $(".exam").show();
        $(".wj").show();
        //实名认证状态查询
        $.ajax(webconfig.base_server + '/exam/faceauthenticationinformation/getByIdNumber', {
          headerToken: 'true',
          type: 'post',
          dataType: 'json',
          data: {
            idNumber: webconfig.getUser().username,
            studentId: webconfig.getUser().id,
          },
          success: function (jsondata) {
            if (jsondata.data == null || jsondata.data.realNameAuthenticationStatus == 0 || jsondata.data.realNameAuthenticationStatus == null) {
              // 去实名认证
              layui.data(webconfig.tableName, {
                key: 'centerWZ',
                value: "myset"
              });
              layui.data(webconfig.tableName, {
                key: 'centerWZ',
                value: "myauthentication"
              });
              var str = '/center.html';
              parent.location.href = str;
            }
          },
          error: function (xhr) {
            common.throwException(xhr);
          }
        })
      } else {
        $(".fwj").show();
      }
    },
    error: function (xhr) {
      common.throwException(xhr);
    }
  });

  let timer;
  //未学完的左右切换按钮
  $(".prevStudy").on("click", function () {
    clearTimeout(timer);
    timer = setTimeout(() => {
      $(".contentStudy ul").animate({
        "margin-left": "+240px"
      }, function () {
        $(".contentStudy ul li:eq(-1)").prependTo($(".contentStudy ul"));
        $(".contentStudy ul").css({
          "margin-left": "0"
        });
      });
      console.log("防抖成功！");
    }, 500);
  });

  $(".nextStudy").on("click", function () {
    clearTimeout(timer);
    timer = setTimeout(() => {
      $(".contentStudy ul").animate({
        "margin-left": "-240px"
      }, function () {
        $(".contentStudy ul li:eq(0)").appendTo($(".contentStudy ul"));
        $(".contentStudy ul").css({
          "margin-left": "0"
        });
      });
      console.log("防抖成功！");
    }, 500);
  });

  //未合格的左右切换按钮
  $(".prevExam").on("click", function () {
    clearTimeout(timer);
    timer = setTimeout(() => {
      $(".contentExam ul").animate({
        "margin-left": "+240px"
      }, function () {
        $(".contentExam ul li:eq(-1)").prependTo($(".contentExam ul"));
        $(".contentExam ul").css({
          "margin-left": "0"
        });
      });
      console.log("防抖成功！");
    }, 500);
  });

  $(".nextExam").on("click", function () {
    clearTimeout(timer);
    timer = setTimeout(() => {
      $(".contentExam ul").animate({
        "margin-left": "-240px"
      }, function () {
        $(".contentExam ul li:eq(0)").appendTo($(".contentExam ul"));
        $(".contentExam ul").css({
          "margin-left": "0"
        });
      });
      console.log("防抖成功！");
    }, 500);
  });

  // 获取相关课程数据
  window.getClassList = function (curr, limit) {
    layui.use(['webconfig', 'common'], function () {
      var $ = layui.jquery;
      var webconfig = layui.webconfig;
      var common = layui.common;
      var studentId = "";
      if (webconfig.getUser()) {
        studentId = webconfig.getUser().id;
      }
      $.ajax({
        url: webconfig.base_server + "/classes/sydwpxxclassescustomercourse/page",
        data: {
          current: curr,
          size: limit,
          customerId: studentId,
          learningStatus: 1
        },
        contentType: "application/x-www-form-urlencoded",
        type: "get",
        headerToken: 'true',
        success: function (data) {
          if (data.code == 0) {
            if (data.data.records.length > 0) {
              loadClass(data.data);
            }
          }
        },
        error: function (xhr) {
          common.throwException(xhr);
        }
      });
    });
  };
  getClassList(1, 4);
  // 加载相关课程数据
  window.loadClass = function (coursedata) {
    var str = "",
      courseArr = coursedata.records;
    if (courseArr && courseArr.length > 0) {
      str += "<div id='classList'><ul class='lists'>";
      for (var i = 0; i < courseArr.length; i++) {
        // //console.log(courseArr[i]);
        var name = courseArr[i].courseName,
          coverUrl = courseArr[i].coverUrl,
          classPeriod = (courseArr[i].byLearnLength / 3600).toFixed(1),
          id = courseArr[i].courseId,
          classesYear = courseArr[i].classesYear,
          courseTypeName = courseArr[i].courseTypeName;
        var getclassesId = courseArr[i].classesId;
        var firstCourseTypeName = "";
        if (courseArr[i].firstCourseTypeId == common.publicParm) {
          firstCourseTypeName = "公共";
        } else if (courseArr[i].firstCourseTypeId == common.majorParm) {
          firstCourseTypeName = "专业";
        }
        if (!coverUrl) {
          coverUrl = "/images/public/zanwu.png";
        }
        //截取超出的字符串，超出部分显示...
        var a = courseTypeName;
        var b = a;
        if (a != null) {
          if (a.length > 12) {
            b = a.substr(0, 12) + "...";
          } else {
            b = a + "系列";
          }
        }
        // //console.log(id, getclassesId)
        str += "<li class='listItems' title='" + name + "'>";
        str += "<div class='listImgss'>";
        str += "<img src='" + coverUrl + "' class='imgs' onclick='goDetail(\"" + id + "\",\"" + getclassesId + "\")'>";
        str += "<div class='" + (courseArr[i].firstCourseTypeId == "527" ? "iconGreen" : "iconYellow") + "'>";
        str += firstCourseTypeName + "</div>";
        str += "<span class='imageTip2'>" + classesYear + "年度</span>";
        str += "</div>";
        str += "<div class='listInfoss'>";
        str += "<p class='itemTitle' onclick='goDetail(\"" + id + "\",\"" + getclassesId + "\")'>" + name + "</p>";
        str += "<div class='itemInfo'>";
        str += "<div class='itemTime'><span>" + classPeriod + "</span>学时</div>";
        str += "<div class='itemMoney'><span>" + b + "</span></div>";
        str += "<div></div></li>";
      }
      str += "<li class='clear'></li></ul>";
    } else {
      str = "<div style='text-align: center; padding: 200px'>暂无数据</div><div class='clear'></div>";
    }
    document.getElementById('classList').innerHTML = "";
    $('#classList').append(str);
    if (szhy == '01' || szhy == 11) { //卫健学员
      $(".iconYellow").hide();
      $(".itemTime").hide();
    }
  };

  // 切换课程
  window.goDetail = function (id, classesId) {
    if (id != courseid) {
      getAllProgress(id, classesId);
    } else {
      layer.msg("您正在观看中，请勿重复点击");
    }
  };

  //其他课程申请考试
  window.toApplyExams = function (id, classesYear) {
    var switchs = false;
    //播放开关
    $.ajax({
      url: webconfig.base_server + "/admin/dict/type/public/play_status",
      contentType: "application/x-www-form-urlencoded",
      type: 'get',
      success: function (data) {
        var dataTime = data.data;
        for (var i = 0; i < dataTime.length; i++) {
          if (dataTime[i].label) {
            if (classesYear == dataTime[i].label) {
              var date = new Date();
              //年 getFullYear()：四位数字返回年份
              var year = date.getFullYear(); //getFullYear()代替getYear()
              //月 getMonth()：0 ~ 11
              var month = date.getMonth() + 1;
              //日 getDate()：(1 ~ 31)
              var day = date.getDate();
              var times = year + '-' + month + '-' + day;
              var timestamp = Date.parse(times);//当前时间戳
              var startTime = dataTime[i].value.substr(0, 10);//开始时间
              var endTime = dataTime[i].value.substr(11, 21);//结束时间
              var startTimeStamp = Date.parse(new Date(startTime));//转换为时间戳
              var endTimeStamp = Date.parse(new Date(endTime));//转换为时间戳
              switchs = true;
              if (startTimeStamp <= timestamp && timestamp <= endTimeStamp) {
                $.ajax({
                  url: webconfig.base_server + "/exam/studentexaminfo/applyExam",
                  contentType: "application/json",
                  headerToken: 'true',
                  type: 'post',
                  data: JSON.stringify({
                    init: 1,
                    examType: 2,
                    relationId: id
                  }),
                  success: function (data) {
                    layer.closeAll('loading');
                    if (common.isApiData(data)) {
                      var examVo = data.data.data;
                      if (examVo && examVo != null) {
                        $.ajax(webconfig.base_server + '/exam/faceauthenticationinformation/getByIdNumber', {
                          headerToken: 'true',
                          type: 'post',
                          dataType: 'json',
                          data: {
                            idNumber: webconfig.getUser().username,
                            studentId: webconfig.getUser().id,
                          },
                          success: function (jsondata) {
                            if (jsondata.data == null || jsondata.data.realNameAuthenticationStatus == 0 || jsondata.data.realNameAuthenticationStatus == null) {
                              // 去实名认证
                              layui.data(webconfig.tableName, {
                                key: 'centerWZ',
                                value: "myset"
                              });
                              layui.data(webconfig.tableName, {
                                key: 'centerWZ',
                                value: "myauthentication"
                              });
                              var str = '/center.html';
                              parent.location.href = str;
                            } else if (jsondata.data.realNameAuthenticationStatus == '1') {
                              $.ajax({
                                url: webconfig.base_server + "/classes/frontClasses/getClassesInfo/" + classesId,
                                contentType: "application/x-www-form-urlencoded",
                                type: 'GET',
                                headerToken: 'true',
                                dataType: 'json',
                                data: {
                                  id: classesId,
                                  customerId: studentId
                                },
                                success: function (data) {
                                  var rating = data.data.rating;
                                  if (rating != null) {
                                    parent.layer.open({
                                      type: 2,//类型
                                      title: '',//窗口名字
                                      maxmin: false,
                                      closeBtn: 1,
                                      shadeClose: false,//点击遮罩不关闭层
                                      area: ['90%', '90%'],//定义宽和高
                                      content: '../template/examination/instructionsToCandidates.html?courseId=' + id,//打开的内容
                                      success: function (layero, index) {

                                      },
                                      cancel: function () {
                                        window.location.reload();//刷新当前页面
                                      }
                                    })
                                  } else {
                                    appraise();
                                  }
                                },
                                error: function (xhr) {
                                  common.throwException(xhr);
                                }
                              });
                            }
                          },
                          error: function (xhr) {
                            common.throwException(xhr);
                          }
                        })
                      } else {
                        layer.msg('请学完课程后再开始考试，如已完成请耐心等待数据同步后再开始考试', {
                          icon: 1,
                        }, function () {
                          window.close();
                        });
                      }
                    }
                  }
                });
              } else {
                $.ajax({
                  url: webconfig.base_server + "/admin/dict/type/public/wjCourse_switch_tips",
                  contentType: "application/x-www-form-urlencoded",
                  type: "get",
                  success: function (data) {
                    if (common.isApiData(data)) {
                      var getCallListStr = "";
                      $(data.data).each(function (index, item) {
                        getCallListStr += '<p style="margin-top:3px;text-indent:2em;">' + item.value + '</p>';
                      });
                      parent.layer.open({
                        title: '<div style="font-size:17px;">温馨提示</div>',
                        content: '<div style="font-size:17px;">' + getCallListStr + '</div>',
                        btnAlign: 'c',
                        closeBtn: 0,
                        area: ['800px'],
                        btn: ['我知道了'],
                        yes: function (index) {
                          parent.layer.close(index)
                        }
                      });
                    }
                  },
                  error: function (xhr) {
                    common.throwException(xhr);
                  }
                });
              }
            }
          }
        }
        if (!switchs) {
          $.ajax({
            url: webconfig.base_server + "/exam/studentexaminfo/applyExam",
            contentType: "application/json",
            headerToken: 'true',
            type: 'post',
            data: JSON.stringify({
              init: 1,
              examType: 2,
              relationId: id
            }),
            success: function (data) {
              layer.closeAll('loading');
              if (common.isApiData(data)) {
                var examVo = data.data.data;
                if (examVo && examVo != null) {
                  $.ajax(webconfig.base_server + '/exam/faceauthenticationinformation/getByIdNumber', {
                    headerToken: 'true',
                    type: 'post',
                    dataType: 'json',
                    data: {
                      idNumber: webconfig.getUser().username,
                      studentId: webconfig.getUser().id,
                    },
                    success: function (jsondata) {
                      if (jsondata.data == null || jsondata.data.realNameAuthenticationStatus == 0 || jsondata.data.realNameAuthenticationStatus == null) {
                        // 去实名认证
                        layui.data(webconfig.tableName, {
                          key: 'centerWZ',
                          value: "myset"
                        });
                        layui.data(webconfig.tableName, {
                          key: 'centerWZ',
                          value: "myauthentication"
                        });
                        var str = '/center.html';
                        parent.location.href = str;
                      } else if (jsondata.data.realNameAuthenticationStatus == '1') {
                        $.ajax({
                          url: webconfig.base_server + "/classes/frontClasses/getClassesInfo/" + classesId,
                          contentType: "application/x-www-form-urlencoded",
                          type: 'GET',
                          headerToken: 'true',
                          dataType: 'json',
                          data: {
                            id: classesId,
                            customerId: studentId
                          },
                          success: function (data) {
                            var rating = data.data.rating;
                            if (rating != null) {
                              parent.layer.open({
                                type: 2,//类型
                                title: '',//窗口名字
                                maxmin: false,
                                closeBtn: 1,
                                shadeClose: false,//点击遮罩不关闭层
                                area: ['90%', '90%'],//定义宽和高
                                content: '../template/examination/instructionsToCandidates.html?courseId=' + id,//打开的内容
                                success: function (layero, index) {

                                },
                                cancel: function () {
                                  window.location.reload();//刷新当前页面
                                }
                              })
                            } else {
                              appraise();
                            }
                          },
                          error: function (xhr) {
                            common.throwException(xhr);
                          }
                        });
                      }
                    },
                    error: function (xhr) {
                      common.throwException(xhr);
                    }
                  })
                } else {
                  layer.msg('请学完课程后再开始考试，如已完成请耐心等待数据同步后再开始考试', {
                    icon: 1,
                  }, function () {
                    window.close();
                  });
                }
              }
            }
          });
        }
      },
      error: function (xhr) {
        common.throwException(xhr);
      }
    });
  };

  // 获取温馨提示
  window.getCallList = function () {
    $.ajax({
      url: webconfig.base_server + "/admin/dict/type/public/course_tip",
      contentType: "application/x-www-form-urlencoded",
      type: "get",
      success: function (data) {
        if (common.isApiData(data)) {
          var getCallListStr = "";
          $(data.data).each(function (index, item) {
            getCallListStr += '<p>' + item.value + '</p>';
          });
          $(".choosechange-p").append(getCallListStr);
        }
      },
      error: function (xhr) {
        common.throwException(xhr);
      }
    });
  };
  getCallList();
  getcatalogue(); //初始化请求目录
  isStore(); //初始化请求收藏信息


  window.myMsk = function (mskInfo) { //定一个遮罩层临时元素
    var divid = mskInfo.divid,
      mskId = mskInfo.mskId ? mskInfo.mskId : 0,
      ishow = mskInfo.ishow,
      type = mskInfo.type ? mskInfo.type : 0;
    mskId == 0 ? ("n" + new Date().getTime()) : mskId;

    if (mskId == 0) {
      mskId = "n" + new Date().getTime();
    }
    if ($("#" + mskId).length == 0) {
      var opthtml = "";
      if (type == 0) {
        opthtml = "<div class='myMskClass mymsk2' id=\"" + mskId + "\" style=\"width:100%;height:100%;display:none;background:#000;color:#ff0;font-size:26px;margin:1px auto;text-align:center;line-height:580px;vertical-align:center;filter:alpha(opacity=50);opacity: 0.5;position:absolute;z-index:10001;\">视频缓冲中(<span id=\"" + mskId + "_progress\">0</span>/100)...</div>";
      } else {
        opthtml = "<div class='myMskClass mymsk1' id=\"" + mskId + "\" style=\"width:100%;height:100%;display:none;background:#000;color:#ff0;font-size:26px;margin:1px auto;text-align:center;line-height:580px;vertical-align:center;filter:alpha(opacity=50);opacity: 0.5;position:absolute;z-index:10001;\">数据提交中...</div>";
      }
      $(document.body).append(opthtml);
    }
    if (ishow) {
      var sleft = $('#' + divid).offset().left + "px";
      var stop = $('#' + divid).offset().top - 5 + "px";
      var swidth = $('#' + divid).width() + "px";
      var sheight = $('#' + divid).height() + 5 + "px";
      $('#' + mskId).css("left", sleft);
      $('#' + mskId).css("top", stop);

      $('#' + mskId).css("width", swidth);
      $('#' + mskId).css("height", sheight);
      $('#' + mskId).css({
        'display': 'block'
      });
      //绑定resize事件
      $("#" + mskId).resize(function () {
        $('#' + mskId).css("left", sleft);
        $('#' + mskId).css("top", stop);
        $('#' + mskId).css("width", swidth);
        $('#' + mskId).css("height", sheight);
      });

    } else { //移除
      $('#' + mskId).css({
        'display': 'none'
      });
      $('#' + mskId).remove();
    }
    return mskId;
  };

  // layui.use("layer", function () {
  //   //独立版的layer无需执行这一句
  //   var $ = layui.jquery,
  //     layer = layui.layer; //独立版的layer无需执行这一句

  //   //触发事件
  //   // function openmodal() {
  //   //   layer.open({
  //   //     type: 1,
  //   //     title: "课堂练习提醒",
  //   //     id: "mymodal", //防止重复弹出
  //   //     content:
  //   //       "<div class='finishmodal'>" +
  //   //       "<div class='finish-msg'>" +
  //   //       "您需要完成课堂练习方可继续学习" +
  //   //       "</div>" +
  //   //       "<div>" +
  //   //       " 点击下方按钮去练习"
  //   //       +"</div>" +
  //   //       "<div class='finish-bth'>" +
  //   //       "去练习" +
  //   //       "</div>" +
  //   //       "</div>",
  //   //     shade: 0.8, //不显示遮罩
  //   //     yes: function () {
  //   //       layer.closeAll();
  //   //     }
  //   //   });
  //   // }

  //   $("#viedeoplay").on("click", function () {
  //     openmodal();
  //   });
  //   // 人脸核验触发事件
  //   function openFaceModal() {
  //     layer.open({
  //       type: 1,
  //       title: "人脸核验",
  //       closeBtn: false,
  //       id: "facemodal", //防止重复弹出
  //       content: "<div class='face'><div class='faceCenter'><img src='../images/public/qrm.png'></img><p>用微信扫一扫人脸核验，验证通过后方可继续学习</p></div></div>",
  //       yes: function () {
  //         layer.closeAll();
  //       },
  //     });
  //   }

  //   $("#face").on("click", function () {
  //     openFaceModal();
  //   });
  // });

});
