:: Runs unit tests for Extensions

setlocal

pushd %~dp0\..

set VSCODEUSERDATADIR=%TMP%\adsuser-%RANDOM%-%TIME:~6,5%
set VSCODEEXTENSIONSDIR=%TMP%\adsext-%RANDOM%-%TIME:~6,5%
echo %VSCODEUSERDATADIR%
echo %VSCODEEXTENSIONSDIR%
@echo OFF

echo starting admin tool extension windows tests
call .\scripts\code.bat --extensionDevelopmentPath=%~dp0\..\extensions\admin-tool-ext-win --extensionTestsPath=%~dp0\..\extensions\admin-tool-ext-win\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --disableExtensions --remote-debugging-port=9222
echo starting agent tests
call .\scripts\code.bat --extensionDevelopmentPath=%~dp0\..\extensions\agent --extensionTestsPath=%~dp0\..\extensions\agent\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222
echo starting azurecore tests
call .\scripts\code.bat --extensionDevelopmentPath=%~dp0\..\extensions\azurecore --extensionTestsPath=%~dp0\..\extensions\azurecore\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222
echo starting cms tests
call .\scripts\code.bat --extensionDevelopmentPath=%~dp0\..\extensions\cms --extensionTestsPath=%~dp0\..\extensions\cms\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222
echo starting dacpac tests
call .\scripts\code.bat --extensionDevelopmentPath=%~dp0\..\extensions\dacpac --extensionTestsPath=%~dp0\..\extensions\dacpac\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222
echo starting schema compare tests
call .\scripts\code.bat --extensionDevelopmentPath=%~dp0\..\extensions\schema-compare --extensionTestsPath=%~dp0\..\extensions\schema-compare\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222
echo starting notebook tests
call .\scripts\code.bat --extensionDevelopmentPath=%~dp0\..\extensions\notebook --extensionTestsPath=%~dp0\..\extensions\notebook\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222
echo starting resource deployment tests
call .\scripts\code.bat --extensionDevelopmentPath=%~dp0\..\extensions\resource-deployment --extensionTestsPath=%~dp0\..\extensions\resource-deployment\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222

if %errorlevel% neq 0 exit /b %errorlevel%

rmdir /s /q %VSCODEUSERDATADIR%
rmdir /s /q %VSCODEEXTENSIONSDIR%

popd

endlocal
