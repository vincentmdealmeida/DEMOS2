from distutils.core import setup, Extension

demos_encrypt = Extension('demos_encrypt',
                    sources = ['/Users/carey/Downloads/EC-ElGamal/BNsupport.cpp', '/Users/carey/Downloads/EC-ElGamal/bn_pair.cpp', '/Users/carey/Downloads/EC-ElGamal/zzn12a.cpp',
                     '/Users/carey/Downloads/EC-ElGamal/ecn2.cpp', '/Users/carey/Downloads/EC-ElGamal/zzn4.cpp', '/Users/carey/Downloads/EC-ElGamal/zzn2.cpp',
                      '/Users/carey/Downloads/EC-ElGamal/big.cpp', '/Users/carey/Downloads/EC-ElGamal/zzn.cpp', '/Users/carey/Downloads/EC-ElGamal/ecn.cpp'],
                    include_dirs = ['/Users/carey/Downloads/EC-ElGamal'],
                    library_dirs = ['/Users/carey/Downloads/EC-ElGamal'],
                    extra_link_args=[''],
                    libraries=['miracl'])

setup (name = 'demos_encrypt',
       version = '1.0',
       description = 'This is the demos2 package',
       ext_modules = [demos_encrypt])
