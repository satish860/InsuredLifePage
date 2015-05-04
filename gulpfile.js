var gulp=require('gulp');
var del=require('del');
var to5=require('gulp-babel');
var plumber=require('gulp-plumber');
var assign=Object.assign || require('object.assign');
var changed=require('gulp-changed');
var sourcemaps=require('gulp-sourcemaps');
var runsequence=require('run-sequence');
var browsersync=require('browser-sync');

var sourcePath='src/';
var outputPath='dest';

var paths={
  source: sourcePath + '**/*.js',
  sourceMapRelativePath:'../' + sourcePath,
  Mainhtml:'index.html',
  componentHtml:sourcePath+'**/*.html'
};
/// Options for Babel compiler . Current options are set to work with the System.JS module
/// Look at the JSPM compiler
var babelOptions={
  modules: 'system',
  moduleIds: false,
  comments: false,
  compact: false,
  stage:2,
  optional: [
    "es7.decorators",
    "es7.classProperties"
  ]	
};

/* Cleans the destination . This should be a repeatable task
   can be done at any point of time and any number of time. 
 Immutable builds are one of the important concept which we will try to make every time.*/
gulp.task('clean',function(cb) {
	del([outputPath],cb);
});

/* Build System task - Takes the files in Es6 and converts into ES6 and drop it in the output path
    This done with Babel(babel.io) . 
    Gulp-changed - Detects the changes in the folder given and builds only those files
    Which gives the improvement in the performance */
gulp.task('build-system',function(){
    return gulp.src(paths.source)
         .pipe(plumber())
         .pipe(changed(outputPath,{extension:'js'}))
         .pipe(sourcemaps.init({loadMoaps:true}))
         .pipe(to5(assign({}, babelOptions, {modules:'system'})))
         .pipe(sourcemaps.write({includeContent: false, sourceRoot: paths.sourceMapRelativePath }))
         .pipe(gulp.dest(outputPath));
});

gulp.task('build',function(callback){
  return runsequence('clean',['build-system'],callback);
});

gulp.task('serve',function(done){
  browsersync({
    open:false,
    port:9000,
    server:{
      base:['.'],
      middleware:function(req,res,next){
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      }
    }
  },done);
});

gulp.task('watch',['serve'],function(){
  gulp.watch(paths.source, ['build-system', browsersync.reload]).on('change', reportChange);
  gulp.watch(paths.Mainhtml, browsersync.reload).on('change', reportChange);
  gulp.watch(paths.componentHtml, browsersync.reload).on('change', reportChange);
  gulp.watch(paths.style, browsersync.reload).on('change', reportChange);

});

function reportChange(event){
  console.log('File ' + event.path + ' was ' + event.type + ', running tasks...');
}




