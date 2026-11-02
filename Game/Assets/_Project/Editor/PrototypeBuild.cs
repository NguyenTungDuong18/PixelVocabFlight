using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace PixelVocabFlight.Editor
{
    public static class PrototypeBuild
    {
        private const string ScenePath = "Assets/_Project/Scenes/Flight.unity";

        [MenuItem("Wordwing/Create prototype scene")]
        public static void CreateScene()
        {
            var previousScene = UnityEngine.SceneManagement.SceneManager.GetActiveScene();
            if (!Application.isBatchMode && string.IsNullOrEmpty(previousScene.path) && previousScene.isDirty)
                throw new InvalidOperationException("Lưu scene đang chỉnh sửa trước khi tạo scene prototype.");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, Application.isBatchMode ? NewSceneMode.Single : NewSceneMode.Additive);
            UnityEngine.SceneManagement.SceneManager.SetActiveScene(scene);
            var cameraObject = new GameObject("Main Camera", typeof(Camera), typeof(AudioListener));
            var camera = cameraObject.GetComponent<Camera>();
            cameraObject.tag = "MainCamera";
            camera.transform.position = new Vector3(0, 0, -10);
            camera.orthographic = true;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = UiKit.Ink;
            new GameObject("Wordwing", typeof(FlightGame));
            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
            EditorSceneManager.SaveScene(scene, ScenePath);
            if (!Application.isBatchMode)
            {
                if (previousScene.IsValid()) UnityEngine.SceneManagement.SceneManager.SetActiveScene(previousScene);
                EditorSceneManager.CloseScene(scene, true);
            }
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            PlayerSettings.companyName = "PixelVocabFlight";
            PlayerSettings.productName = "Wordwing";
            PlayerSettings.bundleVersion = "0.1.0";
            PlayerSettings.defaultScreenWidth = 1280;
            PlayerSettings.defaultScreenHeight = 800;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.runInBackground = false;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Standalone, ScriptingImplementation.Mono2x);
            EditorSettings.defaultBehaviorMode = EditorBehaviorMode.Mode2D;
            AssetDatabase.SaveAssets();
            Debug.Log("WORDWING: prototype scene created.");
        }

        [MenuItem("Wordwing/Build Windows prototype")]
        public static void BuildWindows()
        {
            if (!File.Exists(ScenePath)) CreateScene();
            PlayerSettings.bundleVersion = "0.4.0";
            AssetDatabase.SaveAssets();
            string projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, "../.."));
            string output = Path.Combine(projectRoot, "Builds", "Windows", "Wordwing.exe");
            string[] args = Environment.GetCommandLineArgs();
            int outputIndex = Array.IndexOf(args, "-wordwingBuildOutput");
            if (outputIndex >= 0 && outputIndex + 1 < args.Length) output = args[outputIndex + 1];
            Directory.CreateDirectory(Path.GetDirectoryName(output));
            BuildReport report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ScenePath }, locationPathName = output,
                target = BuildTarget.StandaloneWindows64, options = BuildOptions.None
            });
            if (report.summary.result != BuildResult.Succeeded)
                throw new InvalidOperationException("Windows build failed: " + report.summary.totalErrors + " errors.");
            Debug.Log("WORDWING: Windows build succeeded: " + output);
        }
    }
}
